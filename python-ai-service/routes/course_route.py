from flask import Blueprint, request, jsonify
import sqlite3
import os
import json
import numpy as np
import faiss
from datetime import datetime, timezone
from utils.file_utils import download_file
from utils.text_utils import extract_text, recursive_chunk
from models.embedding import model
from config.database import DB_PATH
from utils.faiss_utils import (
    faiss_course_index,
    course_index_file,
    faiss_submission_index,
    submission_index_file,
)

course_bp = Blueprint("course", __name__)


@course_bp.route("/process_material_course", methods=["POST"])
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
@course_bp.route("/process_material/<int:material_id>", methods=["POST"])
def process_material(material_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT s3_url FROM materials WHERE id = ?", (material_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "error": "Material not found"}), 404

    file_url = row[0]
    if not file_url:
        conn.close()
        return jsonify({"success": False, "error": "No file URL in material"}), 400

    cursor.execute(
        "UPDATE materials SET processingStatus = ? WHERE id = ?",
        ("processing", material_id),
    )
    conn.commit()

    try:
        local_path = download_file(file_url)
        text = extract_text(local_path)
        chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)
        chunk_inputs = [f"passage: {c}" for c in chunks]
        embeddings = model.encode(chunk_inputs, convert_to_numpy=True).astype(
            np.float32
        )
        faiss.normalize_L2(embeddings)

        for chunk_text, embedding in zip(chunks, embeddings):
            faiss_id = np.random.randint(1, 1 << 60, dtype=np.int64)
            faiss_course_index.add_with_ids(
                embedding.reshape(1, -1), np.array([faiss_id], dtype=np.int64)
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
@course_bp.route("/get_materials_by_course/<course_id>", methods=["GET"])
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
@course_bp.route("/delete_material/<int:material_id>", methods=["DELETE"])
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


@course_bp.route("/delete_course/<course_id>", methods=["DELETE"])
def delete_course(course_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
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


@course_bp.route("/delete_all_courses", methods=["DELETE"])
def delete_all_courses():
    global faiss_course_index, faiss_submission_index
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT s3_key FROM materials")
        mats = cursor.fetchall()
        s3_keys = [r[0] for r in mats if r[0]]
        total_materials_deleted = len(mats)

        cursor.execute("DELETE FROM materials")
        conn.commit()

        faiss_course_index.reset()
        faiss_submission_index.reset()
        print("Reset FAISS course & submission indexes")

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


# demo
@course_bp.route("/demo-materials/<int:material_id>", methods=["GET"])
def get_material_by_id(material_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, title, s3_url, s3_key, fileType, courseId, submissionId, ownerType
            FROM materials
            WHERE id = ?
            """,
            (material_id,),
        )
        row = cursor.fetchone()

        if not row:
            return jsonify({"success": False, "message": "Material not found"}), 404

        return jsonify({
            "success": True,
            "material": {
                "id": row[0],
                "title": row[1],
                "s3_url": row[2],
                "s3_key": row[3],
                "fileType": row[4],
                "courseId": row[5],
                "submissionId": row[6],
                "ownerType": row[7],
            }
        })
    finally:
        conn.close()
