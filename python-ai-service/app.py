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

app = Flask()
model = SentenceTransformer("all-MiniLM-L6-v2")

def download_file(url): 
    resp = requests.get(url)
    if resp.status_code != 200:
        raise Exception("Failed to download file")

    # lấy extension từ URL (vd: .pdf, .docx)
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

if __name__ == "__main__":
    file_url = "https://my-graduation-thesis.s3.ap-southeast-2.amazonaws.com/courses/1756128812914_project.pdf"

    local_path = download_file(file_url)
    print(f"Downloaded file to {local_path}")

    text = extract_text(local_path)
    print(f"Extracted text length: {len(text)} characters")
    print(f"Extracted text preview: {text[:500]}...")

    # recursive chunking
    chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)
    for i, chunk in enumerate(chunks):
        print(f"\n------ Chunk {i+1} ------")
        print(chunk)
        print(f"(Length: {len(chunk)} characters)")
    print(f"Number of chunks: {len(chunks)}")
    print(f"First chunk preview: {chunks[0][:500]}...")

    embeddings = model.encode(chunks, convert_to_numpy=True)
    print(f"Embeddings shape: {embeddings.shape}")
    print(f"Embedding dimension: {len(embeddings)}")

    os.unlink(local_path)