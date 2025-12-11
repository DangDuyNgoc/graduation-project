import requests
from bs4 import BeautifulSoup
import urllib.parse
import trafilatura
import re
from difflib import SequenceMatcher
import numpy as np
import json
import sqlite3
import time
from keybert import KeyBERT
from config.database import DB_PATH
from models.embedding import model
from utils.text_utils import recursive_chunk
from concurrent.futures import ThreadPoolExecutor, as_completed
from utils.faiss_utils import faiss_course_index, faiss_submission_index


# ssl safe request with retries
def safe_request(url, headers=None, timeout=10, retries=2, params=None):
    for _ in range(retries):
        try:
            return requests.get(url, headers=headers, timeout=timeout, params=params)
        except Exception:
            time.sleep(0.3)
    return None


# duckduckgo lite search
def ddg_lite_search(query, num_results=3):
    urls = []
    try:
        url = "https://lite.duckduckgo.com/lite/"
        headers = {"User-Agent": "Mozilla/5.0"}
        params = {"q": query}

        resp = safe_request(url, headers=headers, timeout=10, params=params)
        if not resp or resp.status_code != 200:
            return urls

        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/l/?" in href and "uddg=" in href:
                parsed = urllib.parse.urlparse(href)
                q = urllib.parse.parse_qs(parsed.query)
                real_url = q.get("uddg", [None])[0]
                if real_url:
                    urls.append(real_url)
            if len(urls) >= num_results:
                break
    except Exception as e:
        print(f"[ERROR] ddg_lite_search: {e}")

    return urls


# fetch web snippet
def fetch_web_snippet(url, max_words=1200, chunk_size=500, chunk_overlap=30):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = safe_request(url, headers=headers, timeout=10)
        if not resp or resp.status_code != 200:
            return []

        text = trafilatura.extract(resp.text, favor_recall=True) or ""

        full_text = re.sub(r"\s+", " ", text).strip()

        words = full_text.split()
        limited_text = " ".join(words[:max_words])

        chunks = recursive_chunk(
            limited_text,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

        # remove duplicate
        chunks = list(dict.fromkeys(chunks))

        return chunks

    except Exception as e:
        print(f"[ERROR] fetch_web_snippet: {e}")
        return []


# string similarity
def normalize_text(text):
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)
    return text.strip()


def substring_similarity(text1, text2):
    return SequenceMatcher(None, normalize_text(text1), normalize_text(text2)).ratio()


# semantic similarity batch
def semantic_similarity_batch(chunk_text, snippets, model):
    if not snippets:
        return []

    snippet_inputs = [f"passage: {s}" for s in snippets]
    query_input = [f"query: {chunk_text}"]

    emb_snippets = model.encode(
        snippet_inputs, convert_to_numpy=True, show_progress_bar=False
    ).astype(np.float32)
    emb_query = model.encode(
        query_input, convert_to_numpy=True, show_progress_bar=False
    )[0].astype(np.float32)

    emb_snippets /= np.linalg.norm(emb_snippets, axis=1, keepdims=True)
    emb_query /= np.linalg.norm(emb_query)

    sims = np.dot(emb_snippets, emb_query)
    return sims.tolist()


# keybert keyword extraction
kw_model = KeyBERT(model="distiluse-base-multilingual-cased-v2")

stop_words_vi_en = [
    "và",
    "là",
    "của",
    "cho",
    "để",
    "trên",
    "với",
    "một",
    "cái",
    "những",
    "the",
    "of",
    "and",
    "to",
    "in",
    "for",
    "with",
    "a",
    "an",
    "on",
]

keyword_cache = {}


def extract_keywords(text, top_n=25):
    if text in keyword_cache:
        return keyword_cache[text]

    keywords = kw_model.extract_keywords(
        text, keyphrase_ngram_range=(1, 2), stop_words=stop_words_vi_en, top_n=top_n
    )
    result = [kw[0] for kw in keywords]
    keyword_cache[text] = result
    return result


def jaccard_similarity(text1, text2, n=5):
    def ngrams(text):
        words = text.split()
        return set(tuple(words[i : i + n]) for i in range(len(words) - n + 1))

    set1, set2 = ngrams(text1), ngrams(text2)
    if not set1 or not set2:
        return 0.0
    return len(set1 & set2) / len(set1 | set2)


# main plagiarism check function
def check_plagiarism_material(
    material_id,
    num_results=3,
    exact_threshold=0.90,
    semantic_threshold=0.80,
    ngram_threshold=0.3,
    top_k=5,
    semantic_weight=0.7,
    ngram_weight=0.3,
):
    results = {"online": [], "database": []}
    total_sim_sum = 0.0
    total_chunks = 0

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT faissId, text, embedding FROM chunks WHERE materialId=?", (material_id,)
    )
    chunks = cursor.fetchall()

    faiss_indexes = [
        ("course", faiss_course_index),
        ("submission", faiss_submission_index),
    ]

    url_snippet_cache = {}
    embedding_cache = {}
    chunk_ngram_cache = {}
    seen_snippets_global = set()

    for idx, (faiss_id, chunk_text, embedding_json) in enumerate(chunks, 1):
        total_chunks += 1
        print(f"\n[SCAN] Chunk {idx}/{len(chunks)}")
        print(f"[CHUNK TEXT] {chunk_text[:200]}{'...' if len(chunk_text)>200 else ''}")

        try:
            keywords = extract_keywords(chunk_text, top_n=20)
            query = " ".join(keywords) if keywords else chunk_text[:200]
            urls = ddg_lite_search(query, num_results=num_results)

            if chunk_text not in chunk_ngram_cache:
                chunk_ngram_cache[chunk_text] = chunk_text

            # process URL
            def process_url(url):
                try:
                    snippets = url_snippet_cache.get(url)
                    if snippets is None:
                        snippets = fetch_web_snippet(url)
                        url_snippet_cache[url] = snippets

                    url_matches = []
                    for snippet in snippets:
                        if snippet in seen_snippets_global:
                            continue

                        sem_sim = semantic_similarity_batch(
                            chunk_text, [snippet], model
                        )
                        sem_sim = sem_sim[0] if sem_sim else 0.0
                        ngram_sim = jaccard_similarity(chunk_text, snippet, n=5)
                        final_score = (
                            semantic_weight * sem_sim + ngram_weight * ngram_sim
                        )
                        exact_sim = substring_similarity(chunk_text, snippet)

                        match_type = None
                        if exact_sim >= exact_threshold or ngram_sim >= ngram_threshold:
                            match_type = "EXACT COPY"
                        elif final_score >= semantic_threshold:
                            match_type = "SEMANTIC MATCH"
                        else:
                            match_type = "LOW_MATCH"

                        print(
                            f"[ONLINE LOG] URL: {url}\n"
                            # f"ChunkText: {chunk_text[:200]}...\n"
                            # f"SnippetText: {snippet[:100]}...\n"
                            f"Exact={exact_sim:.3f} | SEM={sem_sim:.3f} | Ngram={ngram_sim:.3f} | Final={final_score:.3f} | MatchType={match_type}\n"
                        )

                        url_matches.append(
                            {
                                "url": url,
                                "chunkText": chunk_text,
                                "snippetText": snippet,
                                "exact_sim": exact_sim,
                                "semantic_sim": sem_sim,
                                "ngram_sim": ngram_sim,
                                "final_score": final_score,
                                "match_type": match_type,
                            }
                        )
                        seen_snippets_global.add(snippet)

                    return url_matches

                except Exception as e:
                    print(f"[ERROR] process_url {url}: {e}")
                    return []

            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = {executor.submit(process_url, u): u for u in urls}
                for future in as_completed(futures):
                    url_matches = future.result()
                    results["online"].extend(url_matches)

        except Exception as e:
            print(f"[ERROR online] {e}")

        # database check
        try:
            if not embedding_json:
                continue

            chunk_emb = embedding_cache.get(embedding_json)
            if chunk_emb is None:
                chunk_emb = np.array(json.loads(embedding_json), dtype=np.float32)
                chunk_emb /= np.linalg.norm(chunk_emb)
                embedding_cache[embedding_json] = chunk_emb

            per_chunk_sims = []

            for index_name, faiss_index in faiss_indexes:
                if faiss_index is None:
                    continue

                D, I = faiss_index.search(chunk_emb.reshape(1, -1), k=top_k + 1)
                neighbor_embs = []
                neighbor_rows = []

                for distance, neighbor_id in zip(D[0], I[0]):
                    if neighbor_id == faiss_id or neighbor_id < 0:
                        continue
                    cursor.execute(
                        "SELECT text, embedding, materialId FROM chunks WHERE faissId=?",
                        (int(neighbor_id),),
                    )
                    row = cursor.fetchone()
                    if not row:
                        continue
                    n_text, n_emb_json, n_material_id = row
                    if n_material_id == material_id:
                        continue
                    neighbor_rows.append(
                        (neighbor_id, n_text, n_emb_json, n_material_id)
                    )
                    if n_emb_json in embedding_cache:
                        neighbor_embs.append(embedding_cache[n_emb_json])
                    else:
                        emb = np.array(json.loads(n_emb_json), dtype=np.float32)
                        emb /= np.linalg.norm(emb)
                        embedding_cache[n_emb_json] = emb
                        neighbor_embs.append(emb)

                if neighbor_embs:
                    neighbor_embs = np.stack(neighbor_embs)
                    sims = np.dot(neighbor_embs, chunk_emb)
                    for (
                        neighbor_id,
                        n_text,
                        n_emb_json,
                        n_material_id,
                    ), sem_sim in zip(neighbor_rows, sims):
                        ngram_sim = jaccard_similarity(chunk_text, n_text, n=5)
                        final_score = (
                            semantic_weight * sem_sim + ngram_weight * ngram_sim
                        )

                        match_type = (
                            "MATCH"
                            if (
                                final_score >= semantic_threshold
                                or ngram_sim >= ngram_threshold
                            )
                            else "LOW_MATCH"
                        )
                        print(
                            f"[DB LOG] ChunkIndex: {idx}\n"
                            # f"ChunkText: {chunk_text[:200]}...\n"
                            f"NeighborMaterialId: {n_material_id} | NeighborFaissId: {neighbor_id}\n"
                            # f"NeighborText: {n_text[:200]}...\n"
                            f"Semantic={sem_sim:.3f} | Ngram={ngram_sim:.3f} | Final={final_score:.3f} | MatchType={match_type}\n"
                        )
                        per_chunk_sims.append(final_score)
                        results["database"].append(
                            {
                                "chunkIndex": idx,
                                "chunkText": chunk_text,
                                "neighborText": n_text,
                                "neighborMaterialId": n_material_id,
                                "similarity": final_score,
                                "chunkFaissId": faiss_id,
                                "neighborFaissId": neighbor_id,
                                "indexSource": index_name,
                                "sourceMaterialId": n_material_id,
                                "match_type": match_type,
                            }
                        )

            total_sim_sum += np.mean(per_chunk_sims) if per_chunk_sims else 0.0

        except Exception as e:
            print(f"[ERROR db] {e}")

    conn.close()

    results["database"].sort(key=lambda x: x.get("similarity", 0.0), reverse=True)
    results["similarityScore"] = (
        round(total_sim_sum / total_chunks, 4) if total_chunks > 0 else 0.0
    )

    print(
        f"\n[SUMMARY] Material {material_id}: online={len(results['online'])}, db={len(results['database'])}, avg={results['similarityScore']}"
    )
    return results
