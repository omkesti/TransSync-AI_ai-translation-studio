from sentence_transformers import SentenceTransformer
import faiss

model = SentenceTransformer('all-MiniLM-L6-v2')
sentences = ['This is an example sentence', 'Each sentence is converted to a vector']

embeddings = model.encode(sentences)
print(embeddings)

