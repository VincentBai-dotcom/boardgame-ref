from typing import Annotated
from functools import lru_cache
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from openai import OpenAI

from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker.hierarchical_chunker import HierarchicalChunker


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    openai_api_key: str

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    """Singleton Settings instance."""
    return Settings()  # type: ignore[call-arg]

def custom_generate_unique_id(route: APIRoute):
    return route.name

app = FastAPI(generate_unique_id_function=custom_generate_unique_id)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Backend server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChunkResponse(BaseModel):
    text: str
    contextualized_text: str
    embedding: list[float]
    index: int
    meta: dict


class ProcessedDocumentResponse(BaseModel):
    chunks: list[ChunkResponse]
    total_chunks: int
    full_text: str


class ErrorResponse(BaseModel):
    detail: str


@lru_cache
def get_document_converter() -> DocumentConverter:
    """Singleton DocumentConverter instance."""
    return DocumentConverter()


@lru_cache
def get_chunker() -> HierarchicalChunker:
    """Singleton HierarchicalChunker instance."""
    return HierarchicalChunker()


@lru_cache
def get_openai_client() -> OpenAI:
    """Singleton OpenAI client instance."""
    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key)

@app.post(
    "/pdf/process",
    response_model=ProcessedDocumentResponse,
    responses={
        400: {
            "model": ErrorResponse,
            "description": "Bad Request - Invalid file format"
        },
        500: {
            "model": ErrorResponse,
            "description": "Internal Server Error - Error processing PDF"
        }
    }
)
async def process_pdf_document(
    file: Annotated[UploadFile, File(description="PDF file to process")]
):
    """
    Upload a PDF file and receive processed document with chunks, embeddings, and full text.

    Returns:
    - List of chunks with original text, contextualized text, embeddings, and metadata
    - Full text of the document
    - Total chunk count
    """
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    converter = get_document_converter()
    chunker = get_chunker()
    openai_client = get_openai_client()
    tmp_file_path: str | None = None

    try:
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name

        # Convert PDF to document
        doc = converter.convert(tmp_file_path).document

        # Extract full text from document
        full_text = doc.export_to_text()

        # Generate chunks
        chunk_iter = chunker.chunk(dl_doc=doc)

        # Process chunks and collect contextualized texts
        chunk_data = []
        contextualized_texts = []
        for idx, chunk in enumerate(chunk_iter):
            contextualized_text = chunker.contextualize(chunk=chunk)
            chunk_data.append({
                "text": chunk.text,
                "contextualized_text": contextualized_text,
                "meta": chunk.meta.export_json_dict() if hasattr(chunk.meta, 'export_json_dict') else {},
                "index": idx
            })
            contextualized_texts.append(contextualized_text)

        # Generate embeddings for all chunks in batch
        embeddings_response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=contextualized_texts
        )

        # Create chunk responses with embeddings
        chunks = []
        for i, chunk_info in enumerate(chunk_data):
            chunks.append(ChunkResponse(
                text=chunk_info["text"],
                contextualized_text=chunk_info["contextualized_text"],
                embedding=embeddings_response.data[i].embedding,
                index=chunk_info["index"],
                meta=chunk_info["meta"]
            ))

        # Clean up temporary file
        if tmp_file_path:
            Path(tmp_file_path).unlink(missing_ok=True)

        return ProcessedDocumentResponse(
            chunks=chunks,
            total_chunks=len(chunks),
            full_text=full_text
        )

    except Exception as e:
        # Clean up on error
        if tmp_file_path:
            Path(tmp_file_path).unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
