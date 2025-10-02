import os
import sys
import json
import sqlite3
import hashlib
from datetime import datetime, timezone
import faiss
import numpy as np

from app import (
    DB_PATH,
    model,
    recursive_chunk,
    extract_text,
    faiss_course_index,
    course_index_file,
)


# --- Xử lý file local và lưu vào DB/FAISS --- #
def process_local_file(material_id, file_path):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    text = extract_text(file_path)
    chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)
    embeddings = model.encode(chunks, convert_to_numpy=True).astype(np.float32)

    # ⚡ normalize để dùng cosine với IndexFlatL2
    faiss.normalize_L2(embeddings)

    for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
        # Tạo hash chunk (chỉ để tham khảo)
        chunk_hash = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()

        # add vào FAISS
        faiss_course_index.add(np.array([embedding], dtype=np.float32))
        faiss_id = faiss_course_index.ntotal - 1

        # insert DB (không còn unique hash)
        cursor.execute(
            """
            INSERT INTO chunks (materialId, text, embedding, faissId, createdAt, hash)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                material_id,
                chunk_text,
                json.dumps(embedding.tolist()),
                faiss_id,
                datetime.now(timezone.utc).isoformat(),
                chunk_hash,
            ),
        )

    # lưu FAISS index
    faiss.write_index(faiss_course_index, course_index_file)
    conn.commit()
    conn.close()
    print(f"✅ Processed {file_path}, total {len(chunks)} chunks saved.")


# --- Check các chunk trong DB + FAISS --- #
def check_material_chunks(material_id, top_k=5):
    results = []

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT faissId, text, embedding FROM chunks WHERE materialId = ?",
        (material_id,),
    )
    chunks = cursor.fetchall()
    print(f"Found {len(chunks)} chunks for material_id={material_id}")

    for idx, (faiss_id, chunk_text, embedding_json) in enumerate(chunks, 1):
        chunk_embedding = np.array(json.loads(embedding_json), dtype=np.float32)

        # ⚡ normalize trước khi search
        faiss.normalize_L2(chunk_embedding.reshape(1, -1))

        D, I = faiss_course_index.search(
            np.array([chunk_embedding], dtype=np.float32), k=top_k + 1
        )

        for distance, neighbor_id in zip(D[0], I[0]):
            if neighbor_id == faiss_id:
                continue  # bỏ chính nó

            cursor.execute(
                "SELECT text, materialId, embedding FROM chunks WHERE faissId = ?",
                (int(neighbor_id),),
            )
            row = cursor.fetchone()
            if not row:
                continue

            n_text, n_material_id, n_embedding_json = row
            n_embedding = np.array(json.loads(n_embedding_json), dtype=np.float32)

            # cosine similarity
            similarity = float(
                np.dot(chunk_embedding, n_embedding)
                / (np.linalg.norm(chunk_embedding) * np.linalg.norm(n_embedding))
            )

            results.append(
                {
                    "chunkIndex": idx,
                    "chunkText": chunk_text[:120]
                    + ("..." if len(chunk_text) > 120 else ""),
                    "neighborText": n_text[:120] + ("..." if len(n_text) > 120 else ""),
                    "neighborMaterialId": n_material_id,
                    "similarity": similarity,
                    "chunkFaissId": faiss_id,
                    "neighborFaissId": neighbor_id,
                }
            )

    conn.close()
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results


# --- main --- #
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_db.py <material_id> <file_path>")
        sys.exit(1)

    material_id = sys.argv[1]
    file_path = sys.argv[2]

    if not os.path.exists(file_path):
        print(f"❌ File {file_path} not found")
        sys.exit(1)

    process_local_file(material_id, file_path)
    results = check_material_chunks(material_id, top_k=5)

    print("\n🔍 Top similar chunks:")
    for r in results[:20]:
        print(
            f"[Chunk {r['chunkIndex']}] similarity={r['similarity']:.4f} | "
            f"chunkFaissId={r['chunkFaissId']} | neighborFaissId={r['neighborFaissId']} | "
            f"neighborMaterialId={r['neighborMaterialId']}\n"
            f"Chunk: {r['chunkText']}\nNeighbor: {r['neighborText']}\n"
            "---------------------------"
        )

    print(f"✅ Done. Total similar pairs found: {len(results)}")
