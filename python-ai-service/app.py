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
from trafilatura import fetch_url, extract
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
    # wrap with IDMap if it not yet
    if not isinstance(faiss_course_index, faiss.IndexIDMap):
        faiss_course_index = faiss.IndexIDMap(faiss_course_index)
        print("Wrapped course index with IDMap")
else:
    base_index = faiss.IndexFlatL2(dimension)
    faiss_course_index = faiss.IndexIDMap(base_index)
    print("Created new FAISS index with IDMap for course")

# submission index for materials
if os.path.exists(submission_index_file):
    faiss_submission_index = faiss.read_index(submission_index_file)
    print("Loaded FAISS index from file")
    # wrap with IDMap if it not yet
    if not isinstance(faiss_submission_index, faiss.IndexIDMap):
        faiss_submission_index = faiss.IndexIDMap(faiss_submission_index)
        print("Wrapped submission index with IDMap")
else:
    base_index = faiss.IndexFlatL2(dimension)
    faiss_submission_index = faiss.IndexIDMap(base_index)
    print("Created new FAISS index with IDMap for submission")


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


@app.route("/process_material_course", methods=["POST"])
def process_material_course():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    data = request.get_json()
    s3_url = data.get("s3_url")
    s3_key = data.get("s3_key")
    title = data.get("title", "untitled")
    file_type = data.get("fileType", "application/octet-stream")
    course_id = data.get("courseId") or data.get("course_id")
    owner_type = data.get("ownerType", "courseMaterial")

    if not s3_url or not course_id:
        return jsonify({"success": False, "error": "Missing s3_url or course_id"}), 400

    try:
        cursor.execute(
            """
            INSERT INTO materials (
                courseId, submissionId, ownerType, title,
                s3_url, s3_key, fileType,
                chunkCount, extractedTextLength, processingStatus
            )
            VALUES (?, NULL, ?, ?, ?, ?, ?, 0, 0, 'pending')
            """,
            (course_id, owner_type, title, s3_url, s3_key, file_type),
        )

        material_id = cursor.lastrowid
        conn.commit()

        print(f"[INFO] Added course material: {title} (courseId={course_id})")

        return jsonify(
            {
                "success": True,
                "message": "Course material metadata saved successfully",
                "_id": material_id,
                "title": title,
                "s3_url": s3_url,
                "s3_key": s3_key,
                "fileType": file_type,
                "course_id": course_id,
                "ownerType": owner_type,
                "processingStatus": "pending",
            }
        )
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] process_material_course: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()


# api processing material of course belong to teacher
@app.route("/process_material/<int:material_id>", methods=["POST"])
def process_material(material_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get file URL from SQLite
    cursor.execute("SELECT s3_url FROM materials WHERE id = ?", (material_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "error": "Material not found"}), 404

    file_url = row[0]
    if not file_url:
        conn.close()
        return jsonify({"success": False, "error": "No file URL in material"}), 400

    # Update status
    cursor.execute(
        "UPDATE materials SET processingStatus = ? WHERE id = ?",
        ("processing", material_id),
    )
    conn.commit()

    try:
        local_path = download_file(file_url)
        text = extract_text(local_path)
        chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)
        embeddings = model.encode(chunks, convert_to_numpy=True).astype(np.float32)
        faiss.normalize_L2(embeddings)

        for chunk_text, embedding in zip(chunks, embeddings):
            faiss_id = np.random.randint(1, 1 << 60, dtype=np.int64)
            faiss_course_index.add_with_ids(
                np.array([embedding]), np.array([faiss_id], dtype=np.int64)
            )
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

        cursor.execute(
            """
            UPDATE materials
            SET processingStatus = ?, chunkCount = ?, extractedTextLength = ?
            WHERE id = ?
            """,
            ("done", len(chunks), len(text), material_id),
        )
        conn.commit()
        faiss.write_index(faiss_course_index, course_index_file)

        try:
            os.unlink(local_path)
        except FileNotFoundError:
            pass

        return jsonify(
            {
                "success": True,
                "materialId": material_id,
                "status": "done",
                "numChunks": len(chunks),
                "embeddingShape": embeddings.shape,
            }
        )

    except Exception as e:
        conn.rollback()
        cursor.execute(
            "UPDATE materials SET processingStatus = ? WHERE id = ?",
            ("error", material_id),
        )
        conn.commit()
        return (
            jsonify(
                {
                    "success": False,
                    "materialId": material_id,
                    "error": str(e),
                }
            ),
            500,
        )

    finally:
        conn.close()


# get materials by course
@app.route("/get_materials_by_course/<course_id>", methods=["GET"])
def get_materials_by_course(course_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, title, s3_url, s3_key, fileType, courseId, submissionId,
                   ownerType, chunkCount, extractedTextLength, processingStatus
            FROM materials
            WHERE courseId = ? AND ownerType = 'courseMaterial'
            """,
            (course_id,),
        )
        rows = cursor.fetchall()

        materials = [
            {
                "_id": row[0],
                "title": row[1],
                "s3_url": row[2],
                "s3_key": row[3],
                "fileType": row[4],
                "courseId": row[5],
                "submissionId": row[6],
                "ownerType": row[7],
                "chunkCount": row[8],
                "extractedTextLength": row[9],
                "processingStatus": row[10],
            }
            for row in rows
        ]

        return jsonify(
            {"success": True, "materials": materials, "count": len(materials)}
        )

    except Exception as e:
        print(f"[ERROR] get_materials_by_course: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        conn.close()


# Delete one material and its chunks
@app.route("/delete_material/<int:material_id>", methods=["DELETE"])
def delete_material(material_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Get s3_key (if stored)
        cursor.execute("SELECT s3_key FROM materials WHERE id = ?", (material_id,))
        s3_row = cursor.fetchone()
        s3_key = s3_row[0] if s3_row and s3_row[0] else None

        # Get FAISS IDs from chunks
        cursor.execute(
            "SELECT faissId FROM chunks WHERE materialId = ?", (material_id,)
        )
        rows = cursor.fetchall()

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
                "s3_key": s3_key,
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
        cursor.execute(
            "SELECT id, s3_key FROM materials WHERE courseId = ?", (course_id,)
        )
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
        s3_keys = []

        # Loop over each material
        for mat_row in mats:
            material_id, s3_key = mat_row
            if s3_key:
                s3_keys.append(s3_key)

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
                "s3_keys": s3_keys,
            }
        )

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        conn.close()


@app.route("/delete_all_courses", methods=["DELETE"])
def delete_all_courses():
    global faiss_course_index, faiss_submission_index  # cần để reset()
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    try:
        # --- Lấy tất cả materials ---
        cursor.execute("SELECT s3_key FROM materials")
        mats = cursor.fetchall()
        s3_keys = [r[0] for r in mats if r[0]]
        total_materials_deleted = len(mats)

        # --- Xóa toàn bộ materials (tự xóa chunks nhờ ON DELETE CASCADE) ---
        cursor.execute("DELETE FROM materials")
        conn.commit()

        # --- Reset FAISS indexes ---
        faiss_course_index.reset()
        faiss_submission_index.reset()
        print("Reset FAISS course & submission indexes")

        # --- Ghi lại file sau khi reset (trống hoàn toàn) ---
        faiss.write_index(faiss_course_index, course_index_file)
        faiss.write_index(faiss_submission_index, submission_index_file)
        print("Saved empty FAISS indexes back to file")

        return jsonify(
            {
                "success": True,
                "message": "Deleted all materials and reset FAISS indexes",
                "materialsDeleted": total_materials_deleted,
                "s3_keys": s3_keys,
            }
        )

    except Exception as e:
        import traceback

        print("DELETE_ALL_COURSES ERROR:", e)
        traceback.print_exc()
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        conn.close()


# get materials by submission
@app.route("/get_materials_by_submission/<submission_id>", methods=["GET"])
def get_materials_by_submission(submission_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, title, s3_url, s3_key, fileType, courseId, submissionId, ownerType, chunkCount, extractedTextLength, processingStatus
            FROM materials
            WHERE submissionId = ?
            """,
            (submission_id,),
        )
        rows = cursor.fetchall()

        materials = [
            {
                "_id": row[0],
                "title": row[1],
                "s3_url": row[2],
                "s3_key": row[3],
                "fileType": row[4],
                "courseId": row[5],
                "submissionId": row[6],
                "ownerType": row[7],
                "chunkCount": row[8],
                "extractedTextLength": row[9],
                "processingStatus": row[10],
            }
            for row in rows
        ]

        return jsonify({"success": True, "materials": materials})
    except Exception as e:
        print(f"[ERROR] get_materials_by_submission: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/process_material_submission", methods=["POST"])
def process_material_submission():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    data = request.get_json()
    s3_url = data.get("s3_url")
    s3_key = data.get("s3_key")
    title = data.get("title", "untitled")
    file_type = data.get("fileType", "application/octet-stream")
    course_id = data.get("course_id") or data.get("courseId")
    submission_id = data.get("submission_id") or data.get("submissionId") or None
    owner_type = data.get("ownerType", "courseMaterial")

    if not s3_url or not course_id:
        return jsonify({"success": False, "error": "Missing s3_url or course_id"}), 400

    try:
        cursor.execute(
            """
            INSERT INTO materials (
                courseId, submissionId, ownerType, title, s3_url, s3_key, fileType,
                chunkCount, extractedTextLength, processingStatus
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'pending')
            """,
            (course_id, submission_id, owner_type, title, s3_url, s3_key, file_type),
        )

        material_id = cursor.lastrowid
        conn.commit()

        return jsonify(
            {
                "success": True,
                "message": "Material metadata saved successfully",
                "_id": material_id,
                "title": title,
                "s3_url": s3_url,
                "s3_key": s3_key,
                "course_id": course_id,
                "submission_id": submission_id,
                "processingStatus": "pending",
            }
        )
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] process_material_submission: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/process_submission", methods=["POST"])
def process_submission():
    data = request.get_json()
    submission_id = data.get("submission_id")
    material_ids = data.get("material_ids", [])

    if not submission_id or not material_ids:
        return jsonify({"error": "Missing submission_id or material_ids"}), 400

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    results = []

    try:
        for material_id in material_ids:
            # --- Lấy thông tin material ---
            cursor.execute(
                "SELECT s3_url, title FROM materials WHERE id = ?", (material_id,)
            )
            row = cursor.fetchone()
            if not row:
                results.append(
                    {"materialId": material_id, "error": "Material not found"}
                )
                continue

            s3_url, title = row

            # --- Cập nhật trạng thái sang 'processing' ---
            cursor.execute(
                "UPDATE materials SET processingStatus='processing' WHERE id=?",
                (material_id,),
            )
            conn.commit()

            # --- Tải và xử lý file ---
            local_path = download_file(s3_url)
            text = extract_text(local_path)

            chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)
            embeddings = model.encode(chunks, convert_to_numpy=True).astype(np.float32)
            faiss.normalize_L2(embeddings)

            # --- Lưu chunks + embeddings ---
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

            # --- Cập nhật material ---
            cursor.execute(
                """
                UPDATE materials
                SET submissionId=?, processingStatus='done',
                    chunkCount=?, extractedTextLength=?
                WHERE id=?
                """,
                (submission_id, len(chunks), len(text), material_id),
            )

            conn.commit()

            # --- Xóa file tạm ---
            try:
                os.unlink(local_path)
            except FileNotFoundError:
                pass

            results.append(
                {
                    "materialId": material_id,
                    "title": title,
                    "numChunks": len(chunks),
                    "status": "done",
                }
            )

        # --- Ghi FAISS index ---
        faiss.write_index(faiss_submission_index, submission_index_file)

        return jsonify(
            {"success": True, "submission_id": submission_id, "results": results}
        )
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] process_submission: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/delete_submission/<submission_id>", methods=["DELETE"])
def delete_submission(submission_id):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    try:
        # --- Lấy tất cả material id của submission ---
        cursor.execute(
            "SELECT id, s3_key FROM materials WHERE submissionId = ?", (submission_id,)
        )
        material_rows = cursor.fetchall()
        material_ids = [r[0] for r in material_rows]
        s3_key = [r[1] for r in material_rows if r[1]]

        if not material_ids:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "No materials found for this submission",
                    }
                ),
                404,
            )

        # --- Lấy FAISS ids từ chunks ---
        cursor.execute(
            f"SELECT faissId FROM chunks WHERE materialId IN ({','.join(['?']*len(material_ids))})",
            material_ids,
        )
        chunk_rows = cursor.fetchall()
        faiss_ids = [r[0] for r in chunk_rows if r[0] is not None]

        # --- Xóa chunks trước ---
        cursor.execute(
            f"DELETE FROM chunks WHERE materialId IN ({','.join(['?']*len(material_ids))})",
            material_ids,
        )
        chunk_count = cursor.rowcount

        # --- Xóa materials ---
        cursor.execute("DELETE FROM materials WHERE submissionId = ?", (submission_id,))
        materials_deleted = cursor.rowcount

        # --- Cập nhật FAISS nếu cần ---
        if faiss_ids:
            ids_array = np.array(faiss_ids, dtype=np.int64)
            faiss_submission_index.remove_ids(ids_array)
            faiss.write_index(faiss_submission_index, submission_index_file)

        conn.commit()

        return jsonify(
            {
                "success": True,
                "message": f"Deleted submission {submission_id}",
                "chunksDeleted": chunk_count,
                "materialsDeleted": materials_deleted,
                "embeddingsDeleted": len(faiss_ids),
                "s3_key": s3_key,
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
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    try:
        # --- Lấy tất cả materials có submissionId (tức là thuộc về bài nộp) ---
        cursor.execute(
            "SELECT id, s3_key FROM materials WHERE submissionId IS NOT NULL"
        )
        material_rows = cursor.fetchall()

        if not material_rows:
            return (
                jsonify({"success": False, "message": "No submissions found"}),
                404,
            )

        material_ids = [r[0] for r in material_rows]
        s3_keys = [r[1] for r in material_rows if r[1]]

        # --- Lấy tất cả FAISS ids từ các chunks liên kết ---
        placeholders = ",".join(["?"] * len(material_ids))
        cursor.execute(
            f"SELECT faissId FROM chunks WHERE materialId IN ({placeholders})",
            material_ids,
        )
        chunk_rows = cursor.fetchall()
        faiss_ids = [r[0] for r in chunk_rows if r[0] is not None]

        # --- Xóa embeddings trong FAISS index nếu có ---
        if faiss_ids:
            ids_array = np.array(faiss_ids, dtype=np.int64)
            faiss_submission_index.remove_ids(ids_array)
            faiss.write_index(faiss_submission_index, submission_index_file)

        # --- Xóa tất cả materials (các chunks sẽ tự xóa nhờ ON DELETE CASCADE) ---
        cursor.execute("DELETE FROM materials WHERE submissionId IS NOT NULL")
        deleted_materials = cursor.rowcount

        conn.commit()

        return jsonify(
            {
                "success": True,
                "message": f"Deleted all submissions: removed {len(faiss_ids)} embeddings and {deleted_materials} materials",
                "s3_keys": s3_keys,
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
    urls = []

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=5)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for a in soup.find_all("a", class_="result__a", limit=num_results):
            href = a.get("href")
            if href and "uddg=" in href:
                parsed = urllib.parse.urlparse(href)
                query_dict = urllib.parse.parse_qs(parsed.query)
                real_url = query_dict.get("uddg", [None])[0]
                if real_url:
                    urls.append(real_url)
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] DuckDuckGo request failed: {e}")

    return urls


# take snippet from website
def fetch_web_snippet(url, max_words=1500, chunk_size=500, chunk_overlap=50):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}

        # Send GET request, with timeout to avoid hanging
        resp = requests.get(url, headers=headers, timeout=(2, 5))
        resp.raise_for_status()  # Raise exception for HTTP errors
        downloaded = resp.text

        # Extract main textual content from HTML
        text = (
            trafilatura.extract(
                downloaded,
                include_comments=False,
                include_tables=False,
                favor_recall=True,
            )
            or ""
        )

        # Extract title and meta description
        soup = BeautifulSoup(downloaded, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        meta_desc_tag = soup.find("meta", attrs={"name": "description"})
        meta_desc = (
            meta_desc_tag["content"].strip()
            if meta_desc_tag and meta_desc_tag.get("content")
            else ""
        )

        # Combine title, description, and main text
        full_text = ". ".join(filter(None, [title, meta_desc, text]))

        # Clean text and limit words
        clean_text = re.sub(r"\s+", " ", full_text).strip()
        words = clean_text.split()
        limited_text = " ".join(words[:max_words])

        # Split into intelligent chunks using recursive_chunk
        chunks = recursive_chunk(
            limited_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )

        return chunks

    except requests.exceptions.RequestException as e:
        # Network errors: timeout, DNS fail, connection refused...
        print(f"[ERROR] Cannot fetch URL {url}: {e}")
    except Exception as e:
        # Any other processing error (parsing, chunking, etc.)
        print(f"[ERROR] Cannot process snippet from {url}: {e}")

    return []


# Normalize text before compare
def normalize_text(text):
    text = text.lower()
    text = re.sub(r"\s+", " ", text)  # merge whitespace
    text = re.sub(r"[^\w\s]", "", text)  # remove punctuation
    return text.strip()


# Exact copy similarity
def substring_similarity(text1, text2):
    return SequenceMatcher(None, normalize_text(text1), normalize_text(text2)).ratio()


def semantic_similarity_batch(chunk_text, snippets, model):
    if not snippets:
        return []

    emb_snippets = model.encode(
        snippets, convert_to_numpy=True, show_progress_bar=False
    )
    emb_chunk = model.encode(
        [chunk_text], convert_to_numpy=True, show_progress_bar=False
    )[0]

    # normalize vectors
    emb_chunk /= np.linalg.norm(emb_chunk)
    emb_snippets /= np.linalg.norm(emb_snippets, axis=1, keepdims=True)

    sims = np.dot(emb_snippets, emb_chunk)
    return sims.tolist()


# quote 20-30 key words by KeyBERT
kw_model = KeyBERT(model="all-MiniLM-L6-v2")


def extract_keywords(text, top_n=25):
    keywords = kw_model.extract_keywords(
        text, keyphrase_ngram_range=(1, 2), stop_words="english", top_n=top_n
    )
    return [kw[0] for kw in keywords]


# check material chunks online and database and return result
def check_plagiarism_material(
    material_id, num_results=5, exact_threshold=0.85, semantic_threshold=0.75, top_k=5
):
    results = {"online": [], "database": []}
    total_sim = 0.0
    total_chunks = 0

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Load all chunks for this material
    cursor.execute(
        "SELECT faissId, text, embedding FROM chunks WHERE materialId = ?",
        (material_id,),
    )
    chunks = cursor.fetchall()
    print(f"[INFO] Found {len(chunks)} chunks for material_id={material_id}")

    # load faiss
    faiss_indexes = [
        ("course", faiss_course_index),
        ("submission", faiss_submission_index),
    ]

    for idx, (faiss_id, chunk_text, embedding_json) in enumerate(chunks, 1):
        total_chunks += 1
        print(f"\n[SCAN] Chunk {idx}/{len(chunks)}")

        # ONLINE SCANNING
        try:
            keywords = extract_keywords(chunk_text, top_n=20)
            query = " ".join(keywords) if keywords else chunk_text[:200]

            urls = ddg_search_urls(query, num_results=num_results)
            urls = list(dict.fromkeys(urls))  # remove duplicates
            if urls:
                seen_snippets = set()
                for url in urls:
                    snippets = fetch_web_snippet(url, max_words=1500, chunk_size=500)
                    if not snippets:
                        continue

                    # remove duplicate snippet text
                    snippets = [s for s in snippets if s not in seen_snippets]
                    seen_snippets.update(snippets)

                    sem_sims = semantic_similarity_batch(chunk_text, snippets, model)

                    for snippet, sem_sim in zip(snippets, sem_sims):
                        exact_sim = substring_similarity(chunk_text, snippet)
                        match_type = None

                        if exact_sim >= exact_threshold:
                            match_type = "EXACT COPY"
                        elif sem_sim >= semantic_threshold:
                            match_type = "SEMANTIC MATCH"

                        if match_type:
                            results["online"].append(
                                {
                                    "chunkIndex": idx,
                                    "chunkText": chunk_text,
                                    "url": url,
                                    "snippet": snippet,
                                    "exact_sim": float(exact_sim),
                                    "semantic_sim": float(sem_sim),
                                    "match_type": match_type,
                                }
                            )
                            print(
                                f"[MATCH-{match_type}] URL={url} (E={exact_sim:.2f}, S={sem_sim:.2f})"
                            )

            time.sleep(0.5)
        except Exception as e:
            print(f"[ERROR online] {e}")

        # DATABASE SCANNING (FAISS)
        try:
            if not embedding_json:
                continue

            # Load and normalize chunk embedding
            chunk_embedding = np.array(json.loads(embedding_json), dtype=np.float32)
            if chunk_embedding.size == 0:
                continue
            chunk_embedding = chunk_embedding / np.linalg.norm(chunk_embedding)

            for index_name, faiss_index in faiss_indexes:
                # FAISS search (inner product)
                D, I = faiss_index.search(
                    np.array([chunk_embedding], dtype=np.float32), k=top_k + 1
                )

                for distance, neighbor_id in zip(D[0], I[0]):
                    if neighbor_id == faiss_id or neighbor_id < 0:
                        continue

                    cursor.execute(
                        "SELECT text, embedding, materialId FROM chunks WHERE faissId = ?",
                        (int(neighbor_id),),
                    )
                    row = cursor.fetchone()
                    if not row:
                        continue

                    n_text, n_embedding_json, n_material_id = row
                    if n_material_id == material_id:
                        continue

                    neighbor_embedding = np.array(
                        json.loads(n_embedding_json), dtype=np.float32
                    )
                    if neighbor_embedding.size == 0:
                        continue
                    neighbor_embedding = neighbor_embedding / np.linalg.norm(
                        neighbor_embedding
                    )

                    similarity = float(np.dot(chunk_embedding, neighbor_embedding))
                    total_sim += similarity

                    results["database"].append(
                        {
                            "chunkIndex": idx,
                            "chunkText": chunk_text,
                            "neighborText": n_text,
                            "neighborMaterialId": (
                                int(n_material_id)
                                if n_material_id is not None
                                else None
                            ),
                            "similarity": similarity,
                            "chunkFaissId": int(faiss_id),
                            "neighborFaissId": int(neighbor_id),
                            "indexSource": index_name,
                        }
                    )

        except Exception as e:
            print(f"[ERROR db] {e}")

    conn.close()

    # Sort database matches by similarity descending
    results["database"].sort(key=lambda x: x.get("similarity", 0.0), reverse=True)

    # Average similarity
    similarityScore = round(total_sim / total_chunks, 4) if total_chunks > 0 else 0.0
    results["similarityScore"] = similarityScore

    print(f"\n[INFO] Done scanning material_id={material_id}")
    print(f" Online matches: {len(results['online'])}")
    print(f" Database matches: {len(results['database'])}")
    print(f" Avg similarityScore: {similarityScore}")

    return results


@app.route("/check_plagiarism/<submission_id>", methods=["GET"])
def check_plagiarism(submission_id):
    try:
        # Fetch all materials belonging to this submission
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title FROM materials WHERE submissionId = ?", (submission_id,)
        )
        material_rows = cursor.fetchall()
        conn.close()

        if not material_rows:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": f"No materials found for submission_id {submission_id}",
                    }
                ),
                404,
            )

        print(f"[INFO] Submission {submission_id} has {len(material_rows)} materials")

        files_result = []

        # Process each material
        for mid, title in material_rows:
            print(f"[SCAN] Checking material {mid} ({title}) ...")

            # Load all chunks for this material
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id, text FROM chunks WHERE materialId = ?", (mid,))
            chunk_rows = cursor.fetchall()
            conn.close()

            all_chunks = [row[1] for row in chunk_rows]

            try:
                # Perform plagiarism detection for this material
                res = check_plagiarism_material(mid)
                online = res.get("online", [])
                database = res.get("database", [])
            except Exception as sub_err:
                print(f"[WARN] Error scanning material {mid}: {sub_err}")
                continue

            # Aggregate best matches for online and database sources
            best_online = {}
            best_database = {}

            # Process online matches
            for match in online:
                chunk = match.get("chunkText")
                sim = match.get("semantic_sim", match.get("exact_sim", 0.0))
                if not chunk:
                    continue
                if chunk not in best_online or sim > best_online[chunk]["similarity"]:
                    best_online[chunk] = {
                        "matchedText": chunk,
                        "similarity": sim,
                        "sourceType": "external",
                        "sourceId": match.get("url"),
                    }

            # Process internal database matches
            for match in database:
                chunk = match.get("chunkText")
                sim = match.get("similarity", 0.0)
                if not chunk:
                    continue
                if (
                    chunk not in best_database
                    or sim > best_database[chunk]["similarity"]
                ):
                    best_database[chunk] = {
                        "matchedText": chunk,
                        "similarity": sim,
                        "sourceType": "internal",
                        "sourceId": str(match.get("neighborMaterialId")),
                    }

            # Combine best match results
            matched_sources = []
            for chunk in all_chunks:
                onl = best_online.get(chunk)
                db = best_database.get(chunk)

                if onl and db:
                    best = onl if onl["similarity"] >= db["similarity"] else db
                elif onl:
                    best = onl
                elif db:
                    best = db
                else:
                    best = {
                        "matchedText": chunk,
                        "similarity": 0.0,
                        "sourceType": None,
                        "sourceId": None,
                    }

                matched_sources.append(best)

            # Calculate average similarity score
            similarity_score = (
                float(np.mean([m["similarity"] for m in matched_sources]))
                if matched_sources
                else 0.0
            )

            # Build report object for this file
            files_result.append(
                {
                    "materialId": mid,
                    "fileName": title,
                    "similarityScore": round(similarity_score, 4),
                    "matchedSources": matched_sources,
                    "reportDetails": f"Matched {sum(1 for m in matched_sources if m['similarity'] > 0)}/{len(all_chunks)} chunks",
                }
            )

        # Return combined report for the entire submission
        response = {
            "success": True,
            "submissionId": submission_id,
            "files": files_result,
        }

        return jsonify(response)

    except Exception as e:
        print(f"[ERROR /check_plagiarism] {e}")
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)
