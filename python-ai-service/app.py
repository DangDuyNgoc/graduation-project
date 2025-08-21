from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

sentences = [
   "The weather is lovely today.",
   "Hello, I'm Duc"
]

embeddings = model.encode(sentences)
print(embeddings.shape)

similarities = model.similarity(embeddings, embeddings)
print(similarities)