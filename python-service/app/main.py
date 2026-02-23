from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel
from typing import List
import PyPDF2
from sentence_transformers import SentenceTransformer
import io

app = FastAPI()

# Load the sentence transformer model
model = SentenceTransformer('all-MiniLM-L6-v2')

class Chunk(BaseModel):
    text: str
    embedding: List[float]

class ProcessedPdf(BaseModel):
    chunks: List[Chunk]

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200):
    words = text.split()
    if not words:
        return []
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
    return chunks

@app.post("/process-pdf/", response_model=ProcessedPdf)
async def process_pdf(file: UploadFile = File(...)):
    pdf_content = await file.read()
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()

    text_chunks = chunk_text(text)
    
    embeddings = model.encode(text_chunks)

    chunks = []
    for i, text_chunk in enumerate(text_chunks):
        chunks.append(Chunk(text=text_chunk, embedding=embeddings[i].tolist()))

    return ProcessedPdf(chunks=chunks)
