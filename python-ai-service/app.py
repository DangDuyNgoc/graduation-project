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
index_file = "faiss_store.index"
if os.path.exists(index_file): 
    faiss_index = faiss.read_index(index_file)
    print("Loaded FAISS index from file")
else:
    faiss_index = faiss.IndexFlatL2(dimension)
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

# api processing of material
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
        # download + extract
        local_path = download_file(file_url)
        text = extract_text(local_path)

        # chunk
        chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)

        # embeddings
        embeddings = model.encode(chunks, convert_to_numpy=True)

        # Add to FAISS
        start_id = faiss_index.ntotal
        faiss_index.add(np.array(embeddings))

        # savings FAISS into file
        faiss.write_index(faiss_index, index_file)

        # Save into DB
        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            faiss_id = start_id + idx
            chunks_col.insert_one({
                "materialId" : ObjectId(material_id),
                "text": chunk_text,
                "embedding": embedding.tolist(),
                "faissId": faiss_id,
                "createdAt": datetime.now(timezone.utc)
            })

        results.append({
            "fileUrl": file_url,
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
        "materialId": material_id,
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
            faiss_index.remove_ids(ids_array)

            # update index file after deleted 
            faiss.write_index(faiss_index, index_file)

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
                faiss_index.remove_ids(ids_array)
                total_embeddings += len(faiss_ids)

            # delete chunks from DB
            deleted = chunks_col.delete_many({"materialId": mat["_id"]})
            total_chunks += deleted.deleted_count

        # update index file
        faiss.write_index(faiss_index, index_file)

        return jsonify({
            "success": True,
            "message": f"Deleted course {course_id}",
            "materials": len(mats),
            "chunksDeleted": total_chunks,
            "embeddingsDeleted": total_embeddings
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

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

            # Add to FAISS
            start_id = faiss_index.ntotal
            faiss_index.add(np.array(embeddings))

            # Saving FAISS into file
            faiss.write_index(faiss_index, index_file)

            # Save into DB
            for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                faiss_id = start_id + idx
                chunks_col.insert_one({
                    "submmissionId": ObjectId(submission_id),
                    "text": chunk_text,
                    "embedding": embedding.tolist(),
                    "chunkIndex": idx,
                    "faissId": faiss_id,
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

if __name__ == "__main__":
    app.run(port=5000, debug=True)