from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import uvicorn

from parser import parse_resume
from scorer import compute_scores
from models import MatchRequest, MatchResponse, Candidate

app = FastAPI(title="ResumeMatch API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",                    # local dev
        "https://ai-resume-match-xi.vercel.app",   # production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ResumeMatch API is running"}


@app.post("/api/parse-resumes")
async def parse_resumes(files: List[UploadFile] = File(...)):
    """
    Upload up to 10 resume files (PDF or DOCX).
    Returns parsed structured data for each resume.
    """
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 resumes allowed.")

    parsed = []
    for file in files:
        if not file.filename.endswith((".pdf", ".docx", ".doc")):
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.filename}")
        content = await file.read()
        result = parse_resume(content, file.filename)
        result["filename"] = file.filename
        parsed.append(result)

    return {"candidates": parsed}


@app.post("/api/match", response_model=MatchResponse)
async def match_candidates(request: MatchRequest):
    """
    Score and rank candidates against a job description.
    Accepts lexical_weight (0-1) and semantic_weight (0-1).
    """
    if not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")
    if not request.candidates:
        raise HTTPException(status_code=400, detail="No candidates provided.")

    scored = compute_scores(
        job_description=request.job_description,
        candidates=[c.model_dump() for c in request.candidates],
        jd_skills=request.jd_skills,
        lexical_weight=request.lexical_weight,
        semantic_weight=request.semantic_weight,
    )

    return MatchResponse(ranked_candidates=scored)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
