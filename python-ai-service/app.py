from sentence_transformers import SentenceTransformer
from flask import Flask, request, jsonify
import requests
import tempfile as te
import pdfplumber
import docx
import os
from langchain.text_splitter import RecursiveCharacterTextSplitter
from datetime import datetime, timezone
import faiss
import numpy as np
import sqlite3
import json
from bs4 import BeautifulSoup
import urllib.parse
from keybert import KeyBERT
import trafilatura
import re
from difflib import SequenceMatcher
import time

DB_PATH = "database.db"

app = Flask(__name__)

model = SentenceTransformer("all-MiniLM-L6-v2")
dimension = 384

# FAISS Index
course_index_file = "faiss_course.index"
submission_index_file = "faiss_submission.index"

# course index for materials
if os.path.exists(course_index_file):
    faiss_course_index = faiss.read_index(course_index_file)
    print("Loaded FAISS index from file")
else:
    faiss_course_index = faiss.IndexFlatL2(dimension)
    print("Created new FAISS index")

# submssion index for materials
if os.path.exists(submission_index_file):
    faiss_submission_index = faiss.read_index(submission_index_file)
    print("Loaded FAISS index from file")
else:
    faiss_submission_index = faiss.IndexFlatL2(dimension)
    print("Created new FAISS index")


# def download_file(url):
#     resp = requests.get(url)
#     if resp.status_code != 200:
#         raise Exception("Failed to download file")

#     # get extension from URL (ex: .pdf, .docx)
#     _, ext = os.path.splitext(url)
#     tmp_file = te.NamedTemporaryFile(delete=False, suffix=ext)
#     tmp_file.write(resp.content)
#     tmp_file.close()
#     return tmp_file.name


def download_file(url):
    # create assets if not exists
    assets_dir = os.path.join(os.path.dirname(__file__), "assets")
    os.makedirs(assets_dir, exist_ok=True)

    # take name file from urk
    filename = os.path.basename(url)
    if not filename:
        # if url does't have name, create name random
        import uuid

        filename = str(uuid.uuid4()) + os.path.splitext(url)[-1]

    file_path = os.path.join(assets_dir, filename)

    # download file
    resp = requests.get(url)
    if resp.status_code != 200:
        raise Exception(f"Failed to download file: {resp.status_code}")

    # write file
    with open(file_path, "wb") as f:
        f.write(resp.content)

    return file_path


def extract_text(file_path):
    if file_path.endswith(".pdf"):
        text = ""
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
        return text
    elif file_path.endswith(".docx"):
        doc = docx.Document(file_path)
        return "\n".join([p.text for p in doc.paragraphs])
    else:
        raise Exception("Unsupported file format")


# Recursive Character Splitter
def recursive_chunk(text, chunk_size=500, chunk_overlap=50):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", "", " "],
    )
    return splitter.split_text(text)


# api processing material of course belong to teacher
# API to process a course material (uploaded by teacher)
@app.route("/process_material/<int:material_id>", methods=["POST"])
def process_material(material_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get file URL from SQLite materials
    cursor.execute("SELECT s3_url FROM materials WHERE id = ?", (material_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Material not found"}), 404

    file_url = row[0]
    if not file_url:
        conn.close()
        return jsonify({"error": "No file URL in material"}), 400

    # Update status to "processing"
    cursor.execute(
        "UPDATE materials SET processingStatus = ? WHERE id = ?",
        ("processing", material_id),
    )
    conn.commit()

    results = []
    try:
        # Download file from S3 and extract text
        local_path = download_file(file_url)
        text = extract_text(local_path)

        # Split text into chunks
        chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)

        # Generate embeddings for chunks
        embeddings = model.encode(chunks, convert_to_numpy=True).astype(np.float32)
        faiss.normalize_L2(embeddings)

        # Save each chunk into FAISS and SQLite
        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            # Create random FAISS ID to ensure uniqueness
            faiss_id = np.random.randint(1, 1 << 60, dtype=np.int64)

            # Add embedding to FAISS
            faiss_course_index.add_with_ids(
                np.array([embedding]), np.array([faiss_id], dtype=np.int64)
            )

            # Insert chunk into SQLite
            cursor.execute(
                """
                INSERT INTO chunks (materialId, text, embedding, faissId, createdAt)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    material_id,
                    chunk_text,
                    json.dumps(embedding.tolist()),
                    int(faiss_id),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

        # Update material status to done
        cursor.execute(
            """
            UPDATE materials
            SET processingStatus = ?, chunkCount = ?, extractedTextLength = ?
            WHERE id = ?
            """,
            ("done", len(chunks), len(text), material_id),
        )
        conn.commit()

        # Persist FAISS index to disk
        faiss.write_index(faiss_course_index, course_index_file)

        results.append(
            {
                "fileUrl": file_url,
                "numChunks": len(chunks),
                "embeddingShape": embeddings.shape,
            }
        )

        # Clean up local file
        os.unlink(local_path)

    except Exception as e:
        # Rollback changes and mark status as error
        conn.rollback()
        cursor.execute(
            "UPDATE materials SET processingStatus = ? WHERE id = ?",
            ("error", material_id),
        )
        conn.commit()
        results.append({"fileUrl": file_url, "error": str(e)})

    finally:
        conn.close()

    return jsonify(
        {
            "materialId": material_id,
            "status": "done" if not any(r.get("error") for r in results) else "error",
            "results": results,
        }
    )


# Delete one material and its chunks
@app.route("/delete_material/<int:material_id>", methods=["DELETE"])
def delete_material(material_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Get FAISS IDs from chunks
        cursor.execute(
            "SELECT faissId FROM chunks WHERE materialId = ?", (material_id,)
        )
        rows = cursor.fetchall()
        if not rows:
            conn.close()
            return (
                jsonify(
                    {"success": False, "message": "No chunks found for this material"}
                ),
                404,
            )

        faiss_ids = [r[0] for r in rows if r[0] is not None]

        # Remove from FAISS index
        if faiss_ids:
            ids_array = np.array(faiss_ids, dtype=np.int64)
            faiss_course_index.remove_ids(ids_array)
            faiss.write_index(faiss_course_index, course_index_file)

        # Delete chunks and material in DB
        cursor.execute("DELETE FROM chunks WHERE materialId = ?", (material_id,))
        cursor.execute("DELETE FROM materials WHERE id = ?", (material_id,))

        conn.commit()
        return jsonify(
            {
                "success": True,
                "message": f"Deleted material {material_id}, removed {len(faiss_ids)} embeddings",
            }
        )
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()


@app.route("/delete_course/<course_id>", methods=["DELETE"])
def delete_course(course_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Find all materials in this course
        cursor.execute("SELECT id FROM materials WHERE courseId = ?", (course_id,))
        mats = cursor.fetchall()

        if not mats:
            return (
                jsonify(
                    {"success": False, "message": "No materials found for this course"}
                ),
                404,
            )

        total_chunks = 0
        total_embeddings = 0

        # Loop over each material
        for mat_row in mats:
            material_id = mat_row[0]

            # Get FAISS ids
            cursor.execute(
                "SELECT faissId FROM chunks WHERE materialId = ?", (material_id,)
            )
            chunk_rows = cursor.fetchall()
            faiss_ids = [r[0] for r in chunk_rows if r[0] is not None]

            if faiss_ids:
                ids_array = np.array(faiss_ids, dtype=np.int64)
                faiss_course_index.remove_ids(ids_array)
                total_embeddings += len(faiss_ids)

            # Count chunks before delete
            cursor.execute(
                "SELECT COUNT(*) FROM chunks WHERE materialId = ?", (material_id,)
            )
            chunk_count = cursor.fetchone()[0]
            total_chunks += chunk_count

            # Delete chunks
            cursor.execute("DELETE FROM chunks WHERE materialId = ?", (material_id,))

        # Delete materials
        cursor.execute("DELETE FROM materials WHERE courseId = ?", (course_id,))
        mats_deleted = cursor.rowcount

        # Commit and save FAISS index
        conn.commit()
        faiss.write_index(faiss_course_index, course_index_file)

        return jsonify(
            {
                "success": True,
                "message": f"Deleted course {course_id}",
                "materialsDeleted": mats_deleted,
                "chunksDeleted": total_chunks,
                "embeddingsDeleted": total_embeddings,
            }
        )

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        conn.close()


@app.route("/process_material_submission", methods=["POST"])
def process_material():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    data = request.get_json()
    s3_url = data.get("s3_url")
    title = data.get("title", "untitled")
    file_type = data.get("fileType", "application/octet-stream")
    course_id = data.get("courseId")
    submission_id = data.get("submissionId")
    owner_type = data.get("ownerType", "submissionMaterial")

    if not s3_url:
        return jsonify({"error": "s3_url required"}), 400

    try:
        local_path = download_file(s3_url)
        text = extract_text(local_path)
        chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)
        embeddings = model.encode(chunks, convert_to_numpy=True).astype(np.float32)

        # insert material
        cursor.execute(
            """
            INSERT INTO materials (courseId, submissionId, ownerType, title, s3_url, fileType, chunkCount, extractedTextLength, processingStatus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'done')
            """,
            (
                course_id,
                submission_id,
                owner_type,
                title,
                s3_url,
                file_type,
                len(chunks),
                len(text),
            ),
        )
        material_db_id = cursor.lastrowid

        # insert chunks
        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            faiss_id = np.random.randint(1, 1 << 60, dtype=np.int64)
            faiss_submission_index.add_with_ids(
                np.array([embedding]), np.array([faiss_id], dtype=np.int64)
            )
            cursor.execute(
                """
                INSERT INTO chunks (materialId, faissId, text, embedding)
                VALUES (?, ?, ?, ?)
                """,
                (
                    material_db_id,
                    int(faiss_id),
                    chunk_text,
                    json.dumps(embedding.tolist()),
                ),
            )

        faiss.write_index(faiss_submission_index, submission_index_file)
        conn.commit()
        os.unlink(local_path)

        return jsonify(
            {
                "id": material_db_id,
                "title": title,
                "s3_url": s3_url,
                "numChunks": len(chunks),
            }
        )
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/process_submission/<int:submission_id>", methods=["POST"])
def process_submission(submission_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT fileUrls FROM submissions WHERE id = ?", (submission_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Submission not found"}), 404

    try:
        file_urls = json.loads(row[0])  # parse JSON string
    except Exception:
        conn.close()
        return jsonify({"error": "Invalid fileUrls format"}), 400

    results = []

    for file_url in file_urls:
        try:
            # Insert material
            cursor.execute(
                """
                INSERT INTO materials (courseId, submissionId, ownerType, title, s3_url, fileType, processingStatus)
                VALUES (?, ?, ?, ?, ?, ?, 'processing')
                """,
                (
                    None,
                    submission_id,
                    "submissionMaterial",
                    os.path.basename(file_url),
                    file_url,
                    "application/octet-stream",
                ),
            )
            material_id = cursor.lastrowid

            # Download + extract
            local_path = download_file(file_url)
            text = extract_text(local_path)

            # Chunk + embed
            chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)
            embeddings = model.encode(chunks, convert_to_numpy=True).astype(np.float32)

            for chunk_text, embedding in zip(chunks, embeddings):
                faiss_id = np.random.randint(1, 1 << 60, dtype=np.int64)
                faiss_submission_index.add_with_ids(
                    np.array([embedding]), np.array([faiss_id], dtype=np.int64)
                )
                cursor.execute(
                    """
                    INSERT INTO chunks (materialId, faissId, text, embedding)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        material_id,
                        int(faiss_id),
                        chunk_text,
                        json.dumps(embedding.tolist()),
                    ),
                )

            # Update material status
            cursor.execute(
                """
                UPDATE materials
                SET processingStatus='done', chunkCount=?, extractedTextLength=?
                WHERE id=?
                """,
                (len(chunks), len(text), material_id),
            )

            conn.commit()
            try:
                os.unlink(local_path)
            except FileNotFoundError:
                pass

            results.append({"fileUrl": file_url, "numChunks": len(chunks)})

        except Exception as e:
            conn.rollback()
            results.append({"fileUrl": file_url, "error": str(e)})

    faiss.write_index(faiss_submission_index, submission_index_file)
    conn.close()

    return jsonify({"submissionId": submission_id, "results": results})


@app.route("/delete_submission/<int:submission_id>", methods=["DELETE"])
def delete_submission(submission_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Fetch FAISS ids from submission_chunks
        cursor.execute(
            "SELECT faissId FROM submission_chunks WHERE submissionId = ?",
            (submission_id,),
        )
        chunk_rows = cursor.fetchall()

        if not chunk_rows:
            return (
                jsonify(
                    {"success": False, "message": "No chunks found for this submission"}
                ),
                404,
            )

        faiss_ids = [r[0] for r in chunk_rows if r[0] is not None]

        # Remove from FAISS if embeddings exist
        if faiss_ids:
            ids_array = np.array(faiss_ids, dtype=np.int64)
            faiss_submission_index.remove_ids(ids_array)

        # Count chunks before deletion
        cursor.execute(
            "SELECT COUNT(*) FROM submission_chunks WHERE submissionId = ?",
            (submission_id,),
        )
        chunk_count = cursor.fetchone()[0]

        # Delete chunks in SQLite
        cursor.execute(
            "DELETE FROM submission_chunks WHERE submissionId = ?", (submission_id,)
        )

        # Commit changes and update FAISS index
        conn.commit()
        if faiss_ids:
            faiss.write_index(faiss_submission_index, submission_index_file)

        return jsonify(
            {
                "success": True,
                "message": f"Deleted submission {submission_id}",
                "chunksDeleted": chunk_count,
                "embeddingsDeleted": len(faiss_ids),
            }
        )

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        conn.close()


@app.route("/delete_all_submissions", methods=["DELETE"])
def delete_all_submissions():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Fetch all FAISS ids from submission chunks
        cursor.execute(
            "SELECT faissId FROM submission_chunks WHERE submissionId IS NOT NULL"
        )
        chunk_rows = cursor.fetchall()

        if not chunk_rows:
            return (
                jsonify(
                    {"success": False, "message": "No chunks found for any submission"}
                ),
                404,
            )

        faiss_ids = [r[0] for r in chunk_rows if r[0] is not None]

        # Remove from FAISS index if embeddings exist
        if faiss_ids:
            ids_array = np.array(faiss_ids, dtype=np.int64)
            faiss_submission_index.remove_ids(ids_array)
            faiss.write_index(faiss_submission_index, submission_index_file)

        # Delete all submission-related chunks in SQLite
        cursor.execute("DELETE FROM submission_chunks WHERE submissionId IS NOT NULL")
        deleted_count = cursor.rowcount

        conn.commit()

        return jsonify(
            {
                "success": True,
                "message": f"Deleted all submissions, removed {deleted_count} chunks and {len(faiss_ids)} embeddings",
            }
        )

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        conn.close()


# DuckDuckGo search take URL
def ddg_search_urls(query, num_results=5):
    url = "https://duckduckgo.com/html/"
    params = {"q": query}
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, params=params, headers=headers)
    soup = BeautifulSoup(resp.text, "html.parser")
    urls = []
    for a in soup.find_all("a", class_="result__a", limit=num_results):
        href = a.get("href")
        if href and "uddg=" in href:
            parsed = urllib.parse.urlparse(href)
            query_dict = urllib.parse.parse_qs(parsed.query)
            real_url = query_dict.get("uddg", [None])[0]
            if real_url:
                urls.append(real_url)
    return urls


# take snippet from website
def fetch_web_snippet(url, max_chars=500):
    try:
        # Fetch by requests with headers
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return ""

        downloaded = resp.text  # pass redirectly HTML for trafilatura

        # Extract main content
        text = trafilatura.extract(
            downloaded, include_comments=False, include_tables=False, favor_recall=True
        )
        if not text:
            text = ""

        # take title + meta description
        soup = BeautifulSoup(downloaded, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        meta_desc_tag = soup.find("meta", attrs={"name": "description"})
        meta_desc = (
            meta_desc_tag["content"].strip()
            if meta_desc_tag and meta_desc_tag.get("content")
            else ""
        )

        snippet = ". ".join(filter(None, [title, meta_desc, text]))
        return snippet[:max_chars]

    except Exception as e:
        print(f"[ERROR] Cannot fetch snippet from {url}: {e}")
        return ""


# Normalize text before compare
def normalize_text(text):
    text = text.lower()
    text = re.sub(r"\s+", " ", text)  # merge whitespace
    text = re.sub(r"[^\w\s]", "", text)  # remove punctuation
    return text.strip()


# Exact copy similarity
def substring_similarity(text1, text2):
    return SequenceMatcher(None, normalize_text(text1), normalize_text(text2)).ratio()


# Semantic similarity
def semantic_similarity(text1, text2):
    emb1 = model.encode([text1], convert_to_numpy=True)
    emb2 = model.encode([text2], convert_to_numpy=True)
    sim = np.dot(emb1, emb2.T)[0][0]
    return sim


# quote 20-30 key words by KeyBERT
kw_model = KeyBERT(model="all-MiniLM-L6-v2")


def extract_keywords(text, top_n=25):
    keywords = kw_model.extract_keywords(
        text, keyphrase_ngram_range=(1, 2), stop_words="english", top_n=top_n
    )
    return [kw[0] for kw in keywords]


# check material chunks online and database and return result
def check_plagiarism_material(
    material_id, num_results=5, exact_threshold=0.7, semantic_threshold=0.7, top_k=5
):
    results = {"online": [], "database": []}

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # take all chunks in DB
    cursor.execute(
        "SELECT faissId, text, embedding FROM chunks WHERE materialId = ?",
        (material_id,),
    )
    chunks = cursor.fetchall()
    print(f"Found {len(chunks)} chunks for material_id={material_id}")

    faiss_indexes = [
        ("course", faiss_course_index),
        ("submission", faiss_submission_index),
    ]

    for idx, (faiss_id, chunk_text, embedding_json) in enumerate(chunks, 1):
        #   onl
        try:
            keywords = extract_keywords(chunk_text, top_n=20)
            query = " ".join(keywords)
            urls = ddg_search_urls(query, num_results=num_results)

            for url in urls:
                snippet = fetch_web_snippet(url, max_chars=500)
                if not snippet:
                    continue

                exact_sim = substring_similarity(chunk_text, snippet)
                sem_sim = semantic_similarity(chunk_text, snippet)

                match_type = None
                if exact_sim >= exact_threshold:
                    match_type = "EXACT COPY"
                elif sem_sim >= semantic_threshold:
                    match_type = "SEMANTIC MATCH"

                if match_type:
                    results["online"].append(
                        {
                            "chunkIndex": idx,
                            "chunkText": chunk_text[:120]
                            + ("..." if len(chunk_text) > 120 else ""),
                            "url": url,
                            "snippet": snippet[:200]
                            + ("..." if len(snippet) > 200 else ""),
                            "exact_sim": exact_sim,
                            "semantic_sim": sem_sim,
                            "match_type": match_type,
                        }
                    )
                time.sleep(1)  # void block
        except Exception as e:
            print(f"[ERROR online] {e}")

        # off in db
        try:
            chunk_embedding = np.array(json.loads(embedding_json), dtype=np.float32)
            faiss.normalize_L2(chunk_embedding.reshape(1, -1))

            for index_name, faiss_index in faiss_indexes:
                D, I = faiss_index.search(
                    np.array([chunk_embedding], dtype=np.float32), k=top_k + 1
                )

                for distance, neighbor_id in zip(D[0], I[0]):
                    if neighbor_id == faiss_id:
                        continue

                    cursor.execute(
                        "SELECT text, materialId FROM chunks WHERE faissId = ?",
                        (int(neighbor_id),),
                    )
                    row = cursor.fetchone()
                    if not row:
                        continue

                    n_text, n_material_id = row

                    # cosine similarity
                    similarity = float(
                        np.dot(chunk_embedding, chunk_embedding)
                        / (
                            np.linalg.norm(chunk_embedding)
                            * np.linalg.norm(chunk_embedding)
                        )
                    )

                    results["database"].append(
                        {
                            "chunkIndex": idx,
                            "chunkText": chunk_text[:120]
                            + ("..." if len(chunk_text) > 120 else ""),
                            "neighborText": n_text[:120]
                            + ("..." if len(n_text) > 120 else ""),
                            "neighborMaterialId": n_material_id,
                            "similarity": similarity,
                            "chunkFaissId": faiss_id,
                            "neighborFaissId": neighbor_id,
                            "indexSource": index_name,  # identify course or submission
                        }
                    )
        except Exception as e:
            print(f"[ERROR db] {e}")

    conn.close()

    # sort database matches for similarity decrease
    results["database"].sort(key=lambda x: x["similarity"], reverse=True)

    return results


def highlight_matches(text, matches):
    highlighted = text

    for m in matches:
        snippet = m["snippet"]
        url = m["url"]

        if snippet.lower() in text.lower():
            highlighted = highlighted.replace(
                snippet, f'<span class="highlight">{snippet}</span>'
            )

        highlighted += (
            f'<div class="source">'
            f'Nguồn: <a href="{url}" target="_blank">{url}</a>'
            f"</div>"
        )

    return highlighted


# hightlight result and return to service nodejs
@app.route("/check_plagiarism/<material_id>", methods=["GET"])
def check_plagiarism(material_id):
    results = check_plagiarism_material(material_id)

    for match in results["online"]:
        match["highlightedHtml"] = highlight_matches(
            match["chunkText"],
            [{"snippet": match["snippet"], "url": match["url"]}],
        )

    for match in results["database"]:
        match["highlightedHtml"] = highlight_matches(
            match["chunkText"],
            [
                {
                    "snippet": match["neighborText"],
                    "url": f"DB:Material-{match['neighborMaterialId']}",
                }
            ],
        )

    return jsonify(results)


if __name__ == "__main__":
    app.run(port=5000, debug=True)
