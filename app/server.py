from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import ValidationError

from app.models import PositionProfile
from app import profiles as profile_store
from app.evaluator import evaluate_application
from app.pdf_parser import extract_text_from_pdf

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

app = FastAPI(title="Application Review", version="0.1.0")

# ── Startup ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    profile_store.seed_example_profiles()


# ── Profile routes ───────────────────────────────────────────────────────────

@app.get("/api/profiles")
async def get_profiles():
    return profile_store.list_profiles()


@app.get("/api/profiles/{profile_id}")
async def get_profile(profile_id: str):
    profile = profile_store.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.post("/api/profiles", status_code=201)
async def create_profile(data: dict):
    try:
        profile = profile_store.create_profile(data)
        return profile
    except (ValidationError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.put("/api/profiles/{profile_id}")
async def update_profile(profile_id: str, data: dict):
    profile = profile_store.update_profile(profile_id, data)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.delete("/api/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    deleted = profile_store.delete_profile(profile_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"ok": True}


# ── Evaluation route ──────────────────────────────────────────────────────────

@app.post("/api/evaluate")
async def evaluate(
    profile_id: str = Form(...),
    applicant_name: str = Form(...),
    application_text: str = Form(default=""),
    resume_text: str = Form(default=""),
    resume_file: UploadFile | None = File(default=None),
):
    profile = profile_store.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Position profile not found")

    # Resolve resume text: prefer uploaded PDF over pasted text
    final_resume_text = resume_text
    if resume_file and resume_file.filename:
        file_bytes = await resume_file.read()
        if resume_file.filename.lower().endswith(".pdf"):
            try:
                final_resume_text = extract_text_from_pdf(file_bytes)
            except Exception as e:
                raise HTTPException(status_code=422, detail=f"Could not read PDF: {e}")
        else:
            # Treat as plain text file
            final_resume_text = file_bytes.decode("utf-8", errors="replace")

    try:
        result = await evaluate_application(
            profile=profile,
            applicant_name=applicant_name,
            application_text=application_text,
            resume_text=final_resume_text,
        )
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation error: {e}")

    return result


# ── Ollama health check ───────────────────────────────────────────────────────

@app.get("/api/ollama-status")
async def ollama_status():
    import httpx
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get("http://localhost:11434/api/tags")
            r.raise_for_status()
            tags = r.json()
            models = [m["name"] for m in tags.get("models", [])]
            return {"connected": True, "models": models}
    except Exception:
        return {"connected": False, "models": []}


# ── Static frontend ───────────────────────────────────────────────────────────

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    index = FRONTEND_DIR / "index.html"
    return FileResponse(str(index))
