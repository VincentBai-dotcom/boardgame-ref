from typing import Annotated
from functools import lru_cache
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel

from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker.hierarchical_chunker import HierarchicalChunker

app = FastAPI()


class ChunkResponse(BaseModel):
    text: str
    contextualized_text: str
    meta: dict


class ChunksResponse(BaseModel):
    chunks: list[ChunkResponse]
    total_chunks: int


@lru_cache
def get_document_converter() -> DocumentConverter:
    """Singleton DocumentConverter instance."""
    return DocumentConverter()


@lru_cache
def get_chunker() -> HierarchicalChunker:
    """Singleton HierarchicalChunker instance."""
    return HierarchicalChunker()

@app.post("/pdf/chunks", response_model=ChunksResponse)
async def extract_pdf_chunks(
    file: Annotated[UploadFile, File(description="PDF file to process")]
):
    """
    Upload a PDF file and receive contextualized chunks.

    Returns a list of chunks with original text, contextualized text, and metadata.
    """
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    converter = get_document_converter()
    chunker = get_chunker()
    tmp_file_path: str | None = None

    try:
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name

        # Convert PDF to document
        doc = converter.convert(tmp_file_path).document

        # Generate chunks
        chunk_iter = chunker.chunk(dl_doc=doc)

        # Process chunks
        chunks = []
        for chunk in chunk_iter:
            contextualized_text = chunker.contextualize(chunk=chunk)

            chunks.append(ChunkResponse(
                text=chunk.text,
                contextualized_text=contextualized_text,
                meta=chunk.meta.export_json_dict() if hasattr(chunk.meta, 'export_json_dict') else {}
            ))

        # Clean up temporary file
        if tmp_file_path:
            Path(tmp_file_path).unlink(missing_ok=True)

        return ChunksResponse(
            chunks=chunks,
            total_chunks=len(chunks)
        )

    except Exception as e:
        # Clean up on error
        if tmp_file_path:
            Path(tmp_file_path).unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
