from flask import jsonify, Blueprint
from utils.plagiarism_utils import check_plagiarism_material
import numpy as np
import sqlite3
from config.database import DB_PATH

plagiarism_bp = Blueprint("plagiarism", __name__)


@plagiarism_bp.route("/check_plagiarism/<submission_id>", methods=["GET"])
def check_plagiarism(submission_id):
    try:
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

        files_result = []

        for mid, title in material_rows:
            try:
                res = check_plagiarism_material(mid)
                online = res.get("online", [])
                database = res.get("database", [])
            except Exception as e:
                print(f"[WARN] Error scanning material {mid}: {e}")
                continue

            all_chunks = list({c["chunkText"] for c in online + database})

            best_online = {}
            best_database = {}

            for match in online:
                chunk = match.get("chunkText")
                sim = match.get(
                    "final_score",
                    match.get("semantic_sim", match.get("exact_sim", 0.0)),
                )

                sim = float(sim)

                if not chunk:
                    continue
                if chunk not in best_online or sim > best_online[chunk]["similarity"]:
                    best_online[chunk] = {
                        "matchedText": chunk,
                        "similarity": sim,
                        "sourceType": "external",
                        "sourceId": match.get("url"),
                    }

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

                best["similarity"] = float(best["similarity"])

                matched_sources.append(best)

            similarity_score = (
                float(np.mean([m["similarity"] for m in matched_sources]))
                if matched_sources
                else 0.0
            )

            files_result.append(
                {
                    "materialId": mid,
                    "fileName": title,
                    "similarityScore": round(similarity_score, 4),
                    "matchedSources": matched_sources,
                    "reportDetails": f"Matched {sum(1 for m in matched_sources if m['similarity'] > 0)}/{len(all_chunks)} chunks",
                }
            )

        response = {
            "success": True,
            "submissionId": submission_id,
            "files": files_result,
        }

        return jsonify(response)

    except Exception as e:
        print(f"[ERROR /check_plagiarism] {e}")
        return jsonify({"success": False, "message": str(e)}), 500
