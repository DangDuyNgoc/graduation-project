from sentence_transformers import SentenceTransformer
from flask import Flask, request, jsonify
from pymongo import MongoClient
from bson import ObjectId
import requests
import tempfile as te
import pdfplumber
import docx
import os
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from datetime import datetime, timezone
import faiss
import numpy as np

app = Flask(__name__)

# MongoDB connection
client = MongoClient("mongodb+srv://ductv21it:tranduc2002@cluster0.jidqxdo.mongodb.net/Blinkit")
db = client["Blinkit"]
submissions = db["submissions"]
materials = db["materials"]
chunks_col = db["chunks"]

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

def download_file(url): 
    resp = requests.get(url)
    if resp.status_code != 200:
        raise Exception("Failed to download file")

    # get extension from URL (ex: .pdf, .docx)
    _, ext = os.path.splitext(url)
    tmp_file = te.NamedTemporaryFile(delete=False, suffix=ext)
    tmp_file.write(resp.content)
    tmp_file.close()
    return tmp_file.name

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

# --- Recursive Character Splitter ---
def recursive_chunk(text, chunk_size = 500, chunk_overlap = 50): 
    splitter = RecursiveCharacterTextSplitter(
        chunk_size = chunk_size,
        chunk_overlap = chunk_overlap,
        separators=["\n\n", "\n", ". ", "", " "]
    )

    return splitter.split_text(text)

# api processing material of course belong to teacher 
@app.route("/process_material/<material_id>", methods=["POST"])
def process_material(material_id):
    doc = materials.find_one({"_id": ObjectId(material_id)})
    if not doc:
        return jsonify({"error": "Materials of course not found"}), 404
    file_url = doc.get("s3_url")
    if not file_url: 
        return jsonify({"error": "No file url in material"}), 400
    
    results = []
    try:
        materials.update_one(
            {"_id": ObjectId(material_id)},
            {"$set": {"processedStatus": "processing"}}
        )

        # download + extract
        local_path = download_file(file_url)
        text = extract_text(local_path)

        # chunk
        chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)

        # embeddings
        embeddings = model.encode(chunks, convert_to_numpy=True)

        # Map embeddings with MongoDB ObjectId as FAISS ID
        faiss_ids = [int(str(ObjectId())[:16], 16) for _ in range(len(chunks))]  # 16 hex chars -> int64
        faiss_course_index.add_with_ids(np.array(embeddings), np.array(faiss_ids, dtype=np.int64))
        faiss.write_index(faiss_course_index, course_index_file)

        # savings FAISS into file
        faiss.write_index(faiss_course_index, course_index_file)

        # Save into DB
        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunks_col.insert_one({
                "materialId" : ObjectId(material_id),
                "text": chunk_text,
                "embedding": embedding.tolist(),
                "chunkIndex": idx,
                "faissId": faiss_ids,
                "createdAt": datetime.now(timezone.utc)
            })

        materials.update_one(
            {"_id": ObjectId(material_id)},
            {"$set": {"processedStatus": "done", 
                      "chunkCount": len(chunks),
                      "extractedTextLength": len(text)
                    }
            })

        results.append({
            "fileUrl": file_url,
            "numChunks": len(chunks),   
            "embeddingShape": embeddings.shape,
        })
        os.unlink(local_path)

    except Exception as e:
        # update status error
        materials.update_one(
            {"_id": ObjectId(material_id)},
            {"$set": {"processedStatus": "error"}}
        )

        results.append({
            "fileUrl": file_url,
            "error": str(e)
        })
    
    return jsonify({
        "materialId": material_id,
        "status": "done",
        "results": results
    })

# delete one materials 
@app.route("/delete_material/<material_id>", methods=["DELETE"])
def delete_material(material_id):
    try:
        # get all chunks related in DB 
        related_chunks = list(chunks_col.find({"materialId": ObjectId(material_id)}))

        if not related_chunks:
            return jsonify({"success": False, "message": "No chunks found for this material"}), 404
        
        # get list of faiss id
        faiss_ids = [c["faissId"] for c in related_chunks if "faissId" in c]

        if faiss_ids: 
            # convert to numpy int64
            ids_array = np.array(faiss_ids, dtype=np.int64)
            faiss_course_index.remove_ids(ids_array)

            # update index file after deleted 
            faiss.write_index(faiss_course_index, course_index_file)

        # delete chunk in DB
        chunks_col.delete_many({"materialId": ObjectId(material_id)})

        return jsonify({
            "success": True,
            "message": f"Deleted material {material_id}, removed {len(faiss_ids)} embeddings"
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    
# delete course
@app.route("/delete_course/<course_id>", methods=["DELETE"])
def delete_course(course_id):
    try:
        # get all materials belong to course
        mats = list(materials.find({"courseId": ObjectId(course_id)}))

        if not mats:
            return jsonify({"success": False, "message": "No materials found for this course"}), 404
        
        total_chunks = 0
        total_embeddings = 0

        for mat in mats:
            # get chunks of material
            related_chunks = list(chunks_col.find({"materialId": mat["_id"]}))
            faiss_ids = [c["faissId"] for c in related_chunks if "faissId" in c]

            if faiss_ids: 
                # convert to numpy int64
                ids_array = np.array(faiss_ids, dtype=np.int64)
                faiss_course_index.remove_ids(ids_array)
                total_embeddings += len(faiss_ids)

            # delete chunks from DB
            deleted = chunks_col.delete_many({"materialId": mat["_id"]})
            total_chunks += deleted.deleted_count

        # update index file
        faiss.write_index(faiss_course_index, course_index_file)

        return jsonify({
            "success": True,
            "message": f"Deleted course {course_id}",
            "materials": len(mats),
            "chunksDeleted": total_chunks,
            "embeddingsDeleted": total_embeddings
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# api processing materials of submission belong to student
@app.route("/process_submission/<submission_id>", methods =["POST"])
def process_submission(submission_id):

    doc = submissions.find_one({"_id": ObjectId(submission_id)})
    if not doc: 
        return jsonify({"error": "Submission not found"}), 404
    
    file_url= doc.get("fileUrls", [])
    if not file_url: 
        return jsonify({"error": "No files in submission"}), 400
    
    results = []

    for file_url in file_url: 
        try: 
            

            # Download + extract
            local_path = download_file(file_url)
            text = extract_text(local_path)

            # Chunk
            chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)

            # Embeddings
            embeddings = model.encode(chunks, convert_to_numpy=True)

            # Map embeddings with MongoDB ObjectId as FAISS ID
            faiss_ids = [int(str(ObjectId())[:16], 16) for _ in range(len(chunks))]  # 16 hex chars -> int64
            faiss_submission_index.add_with_ids(np.array(embeddings), np.array(faiss_ids, dtype=np.int64))
            faiss.write_index(faiss_submission_index, submission_index_file)

            # Saving FAISS into file
            faiss.write_index(faiss_submission_index, submission_index_file)

            # Save into DB
            for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                chunks_col.insert_one({
                    "submissionId": ObjectId(submission_id),
                    "text": chunk_text,
                    "embedding": embedding.tolist(),
                    "chunkIndex": idx,
                    "faissId": faiss_ids,
                    "createdAt": datetime.now(timezone.utc)
                })

            results.append({
                "fileUrls": file_url,
                "numChunks": len(chunks),
                "embeddingShape": embeddings.shape,
            })
            os.unlink(local_path)
        except Exception as e:
            results.append({
                "fileUrl": file_url,
                "error": str(e)
            })

    return jsonify({
        "submissionId": submission_id,
        "results": results
    })

# delete one submission
@app.route("/delete_submission/<submission_id>", methods=["DELETE"])
def delete_submission(submission_id):
    try: 
        # get all chunks related in DB
        related_chunks = list(chunks_col.find({"submissionId": ObjectId(submission_id)}))

        if not related_chunks:
            return jsonify({"success": False, "message": "No chunks found for this material"}), 404
        
        # get list of faiss id
        faiss_ids = [c["faissId"] for c in related_chunks if "faissId" in c]

        if faiss_ids: 
            # convert to numpy int64
            ids_array = np.array(faiss_ids, dtype=np.int64)
            faiss_submission_index.remove_ids(ids_array)

            # update index file after deleted 
            faiss.write_index(faiss_submission_index, submission_index_file)

        # delete chunk in DB
        chunks_col.delete_many({"submissionId": ObjectId(submission_id)})

        return jsonify({
            "success": True,
            "message": f"Deleted material {submission_id}, removed {len(faiss_ids)} embeddings"
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    
# delete all submissions
@app.route("/delete_all_submissions", methods=["DELETE"])
def delete_all_submissions():
    try:
        # get all related chunks in DB
        related_chunks = list(chunks_col.find({"submissionId": {"$exists": True}}))

        if not related_chunks:
            return jsonify({"success": False, "message": "No chunks found for this submission"}), 404
        
        # get list of faiss id
        faiss_ids = [c["faissId"] for c in related_chunks if "faissId" in c]

        if faiss_ids: 
            # convert to numpy int64
            ids_array = np.array(faiss_ids, dtype=np.int64)
            faiss_submission_index.remove_ids(ids_array)

            # update index file after deleted 
            faiss.write_index(faiss_submission_index, submission_index_file)

        # delete chunk in DB
        chunks_col.delete_many({"submissionId": {"$exists": True}})

        return jsonify({
            "success": True,
            "message": f"Deleted all submissions, removed {len(faiss_ids)} embeddings"
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
if __name__ == "__main__":
    app.run(port=5000, debug=True)