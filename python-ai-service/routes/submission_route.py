from flask import Blueprint, request, jsonify
import sqlite3
import numpy as np
import json
import os
import faiss
from config.database import DB_PATH
from utils.file_utils import download_file
from utils.text_utils import extract_text, recursive_chunk
from models.embedding import model
from utils.faiss_utils import faiss_submission_index, submission_index_file

submission_bp = Blueprint("submission", __name__)


# get materials by submission
@submission_bp.route("/get_materials_by_submission/<submission_id>", methods=["GET"])
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


@submission_bp.route("/process_material_submission", methods=["POST"])
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


@submission_bp.route("/process_submission", methods=["POST"])
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

            cursor.execute(
                "UPDATE materials SET processingStatus='processing' WHERE id=?",
                (material_id,),
            )
            conn.commit()

            local_path = download_file(s3_url)
            text = extract_text(local_path)

            chunks = recursive_chunk(text, chunk_size=500, chunk_overlap=50)
            chunk_inputs = [f"passage: {c}" for c in chunks]
            embeddings = model.encode(chunk_inputs, convert_to_numpy=True).astype(
                np.float32
            )

            faiss.normalize_L2(embeddings)

            for chunk_text, embedding in zip(chunks, embeddings):
                faiss_id = np.random.randint(1, 1 << 60, dtype=np.int64)
                faiss_submission_index.add_with_ids(
                    embedding.reshape(1, -1),
                    np.array([faiss_id], dtype=np.int64),
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

            # cleanup local file
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

        # write FAISS index
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


@submission_bp.route("/delete_submission/<submission_id>", methods=["DELETE"])
def delete_submission(submission_id):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    try:
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

        cursor.execute(
            f"SELECT faissId FROM chunks WHERE materialId IN ({','.join(['?']*len(material_ids))})",
            material_ids,
        )
        chunk_rows = cursor.fetchall()
        faiss_ids = [r[0] for r in chunk_rows if r[0] is not None]

        cursor.execute(
            f"DELETE FROM chunks WHERE materialId IN ({','.join(['?']*len(material_ids))})",
            material_ids,
        )
        chunk_count = cursor.rowcount

        cursor.execute("DELETE FROM materials WHERE submissionId = ?", (submission_id,))
        materials_deleted = cursor.rowcount

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


@submission_bp.route("/delete_all_submissions", methods=["DELETE"])
def delete_all_submissions():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    try:
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

        placeholders = ",".join(["?"] * len(material_ids))
        cursor.execute(
            f"SELECT faissId FROM chunks WHERE materialId IN ({placeholders})",
            material_ids,
        )
        chunk_rows = cursor.fetchall()
        faiss_ids = [r[0] for r in chunk_rows if r[0] is not None]

        if faiss_ids:
            ids_array = np.array(faiss_ids, dtype=np.int64)
            faiss_submission_index.remove_ids(ids_array)
            faiss.write_index(faiss_submission_index, submission_index_file)

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
