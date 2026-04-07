import pdfplumber
import io


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract plain text from a PDF file given its raw bytes."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text.strip())
    return "\n\n".join(text_parts)
