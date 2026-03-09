"""Extract text from a PDF file via stdin/stdout.

Usage: python3 pdf_extract.py < input.pdf
Outputs JSON: {"text": "...", "pages": N}
On error: {"error": "..."}
"""

import sys
import json

try:
    import pymupdf
except ImportError:
    print(json.dumps({"error": "pymupdf not installed. Run: pip install pymupdf"}))
    sys.exit(1)


def extract_text(pdf_bytes: bytes) -> dict:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return {"text": "\n".join(pages), "pages": len(pages)}


def main():
    pdf_bytes = sys.stdin.buffer.read()
    if not pdf_bytes:
        print(json.dumps({"error": "No input received on stdin"}))
        sys.exit(1)
    try:
        result = extract_text(pdf_bytes)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
