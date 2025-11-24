import os
import faiss
from models.embedding import dimension


def load_or_create_faiss_index(index_file):
    if os.path.exists(index_file):
        idx = faiss.read_index(index_file)
        print(f"Loaded FAISS index from {index_file}")
        if not isinstance(idx, faiss.IndexIDMap):
            idx = faiss.IndexIDMap(idx)
            print(f"Wrapped {index_file} with IDMap")
    else:
        base_index = faiss.IndexFlatL2(dimension)
        idx = faiss.IndexIDMap(base_index)
        print(f"Created new FAISS index with IDMap for {index_file}, idx {len(idx)}")
    return idx


base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
course_index_file = os.path.join(base_dir, "faiss_course.index")
submission_index_file = os.path.join(base_dir, "faiss_submission.index")

faiss_course_index = load_or_create_faiss_index(course_index_file)
faiss_submission_index = load_or_create_faiss_index(submission_index_file)
