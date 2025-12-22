from docling.document_converter import DocumentConverter
from pathlib import Path

pdf_folder = Path("./pdf")
md_folder = Path("./md")

md_folder.mkdir(exist_ok=True)

converter = DocumentConverter()

pdf_files = list(pdf_folder.glob("*.pdf"))

if not pdf_files:
    print("No PDF files found in ./pdf folder")
else:
    print(f"Found {len(pdf_files)} PDF file(s) to convert")


    for pdf_file in pdf_files:
        print(f"\nConverting: {pdf_file.name}")

        try:
            md = converter.convert(pdf_file).document.export_to_markdown()

            md_file_path = md_folder / f"{pdf_file.stem}.md"
            md_file_path.write_text(md, encoding='utf-8')
            print(f"  ✓ Saved markdown to {md_file_path}")

        except Exception as e:
            print(f"  ✗ Error converting {pdf_file.name}: {str(e)}")

    print(f"\nConversion complete! Output files saved in {md_folder}")