import requests
from bs4 import BeautifulSoup
from app import model  # SentenceTransformer có sẵn
import time
import urllib.parse
from difflib import SequenceMatcher
import numpy as np
from keybert import KeyBERT
import trafilatura
import re


# --- 1. DuckDuckGo search lấy URL --- #
def ddg_search_urls(query, num_results=5):
    url = "https://duckduckgo.com/html/"
    params = {"q": query}
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, params=params, headers=headers)
    soup = BeautifulSoup(resp.text, "html.parser")
    urls = []
    for a in soup.find_all("a", class_="result__a", limit=num_results):
        href = a.get("href")
        if href and "uddg=" in href:
            parsed = urllib.parse.urlparse(href)
            query_dict = urllib.parse.parse_qs(parsed.query)
            real_url = query_dict.get("uddg", [None])[0]
            if real_url:
                urls.append(real_url)
    return urls


# --- 2. Lấy snippet chính xác từ web --- #
def fetch_web_snippet(url, max_chars=500):
    try:
        # 1. Fetch bằng requests với headers
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return ""

        downloaded = resp.text  # pass HTML trực tiếp cho trafilatura

        # 2. Extract nội dung chính
        text = trafilatura.extract(
            downloaded, include_comments=False, include_tables=False, favor_recall=True
        )
        if not text:
            text = ""

        # 3. Lấy title + meta description
        soup = BeautifulSoup(downloaded, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        meta_desc_tag = soup.find("meta", attrs={"name": "description"})
        meta_desc = (
            meta_desc_tag["content"].strip()
            if meta_desc_tag and meta_desc_tag.get("content")
            else ""
        )

        snippet = ". ".join(filter(None, [title, meta_desc, text]))
        return snippet[:max_chars]

    except Exception as e:
        print(f"[ERROR] Cannot fetch snippet from {url}: {e}")
        return ""


# --- Normalize text trước khi so sánh ---
def normalize_text(text):
    text = text.lower()
    text = re.sub(r"\s+", " ", text)  # gộp khoảng trắng
    text = re.sub(r"[^\w\s]", "", text)  # bỏ punctuation
    return text.strip()


# --- 3. Exact copy similarity --- #
def substring_similarity(text1, text2):
    return SequenceMatcher(None, normalize_text(text1), normalize_text(text2)).ratio()


# --- 4. Semantic similarity --- #
def semantic_similarity(text1, text2):
    emb1 = model.encode([text1], convert_to_numpy=True)
    emb2 = model.encode([text2], convert_to_numpy=True)
    sim = np.dot(emb1, emb2.T)[0][0]
    return sim


# --- 5. Trích 20-30 từ trọng tâm bằng KeyBERT --- #
kw_model = KeyBERT(model="all-MiniLM-L6-v2")


def extract_keywords(text, top_n=25):
    keywords = kw_model.extract_keywords(
        text, keyphrase_ngram_range=(1, 2), stop_words="english", top_n=top_n
    )
    return [kw[0] for kw in keywords]


# --- 6. Check plagiarism online --- #
def check_plagiarism_online(
    chunk_large, num_results=5, exact_threshold=0.7, semantic_threshold=0.7
):
    results = []

    # 1. Lấy từ khóa trọng tâm
    keywords = extract_keywords(chunk_large, top_n=25)
    query = " ".join(keywords)
    print(f"[INFO] Query keywords: {query[:200]}{'...' if len(query)>200 else ''}")

    # 2. Search DuckDuckGo
    urls = ddg_search_urls(query, num_results=num_results)
    print(f"[INFO] Found {len(urls)} URLs from DuckDuckGo")

    for url in urls:
        snippet = fetch_web_snippet(url, max_chars=500)
        if not snippet:
            continue

        exact_sim = substring_similarity(chunk_large, snippet)
        sem_sim = semantic_similarity(chunk_large, snippet)

        print(f"\n[WEB] URL: {url}")
        print(f"Snippet preview: {snippet[:200]}...")
        print(f"Exact similarity: {exact_sim:.2f}, Semantic similarity: {sem_sim:.2f}")

        if exact_sim >= exact_threshold:
            match_type = "EXACT COPY"
            print("[MATCH] Likely exact copy!")
        elif sem_sim >= semantic_threshold:
            match_type = "SEMANTIC MATCH"
            print("[MATCH] Likely paraphrased / semantic similarity!")
        else:
            match_type = None
            print("[NO MATCH]")

        if match_type:
            results.append(
                {
                    "chunk": chunk_large,
                    "url": url,
                    "snippet": snippet,
                    "exact_sim": exact_sim,
                    "semantic_sim": sem_sim,
                    "match_type": match_type,
                }
            )
        time.sleep(1)  # tránh bị block

    return results


# --- 7. Test nhanh --- #
if __name__ == "__main__":
    sample_chunk = (
        "MySQL is a widely used relational database management system (RDBMS)."
    )

    results = check_plagiarism_online(sample_chunk, num_results=3)

    if results:
        print("\n[RESULTS] Potential plagiarism found:")
        for r in results:
            print(f"URL: {r['url']}")
            print(f"Match type: {r['match_type']}")
            print(
                f"Exact similarity: {r['exact_sim']:.2f}, Semantic similarity: {r['semantic_sim']:.2f}"
            )
            print(f"Snippet preview: {r['snippet'][:200]}...")
            print("------")
    else:
        print("\nNo potential plagiarism detected.")
