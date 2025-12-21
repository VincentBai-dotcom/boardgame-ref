from docling.document_converter import DocumentConverter
from pathlib import Path
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker

pdf_folder = Path("./pdf")
output_folder = Path("./docling")

output_folder.mkdir(exist_ok=True)

converter = DocumentConverter()

pdf_files = list(pdf_folder.glob("*.pdf"))

if not pdf_files:
    print("No PDF files found in ./pdf folder")
else:
    print(f"Found {len(pdf_files)} PDF file(s) to convert")

    chunker = HybridChunker()

    for pdf_file in pdf_files:
        print(f"\nConverting: {pdf_file.name}")

        try:
            doc = converter.convert(pdf_file).document
            chunk_iter = chunker.chunk(dl_doc=doc)

            for i, chunk in enumerate(chunk_iter):
                print(f"=== {i} ===")
                print(f"chunk.text:\n{f'{chunk.text}…'!r}")

                enriched_text = chunker.contextualize(chunk=chunk)
                print(f"chunker.contextualize(chunk):\n{f'{enriched_text}…'!r}")

                print()

        except Exception as e:
            print(f"  ✗ Error converting {pdf_file.name}: {str(e)}")

    print(f"\nConversion complete! Output files saved in {output_folder}")