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
from datetime import datetime
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
        return jsonify({"error": "Submission not found"}), 404
    # file_url: 

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
                    "createdAt": datetime.utcnow()
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