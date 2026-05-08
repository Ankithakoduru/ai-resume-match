from pydantic import BaseModel, Field
from typing import List, Optional


class CandidateInput(BaseModel):
    name: str
    filename: Optional[str] = None
    raw_text: str
    skills: List[str] = []
    experience_years: Optional[int] = None
    education: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    salary: Optional[str] = None


class MatchRequest(BaseModel):
    job_description: str = Field(..., description="Full job description text")
    candidates: List[CandidateInput] = Field(..., description="List of parsed candidates")
    jd_skills: List[str] = Field(default=[], description="Key skills extracted from JD")
    lexical_weight: float = Field(default=0.5, ge=0.0, le=1.0, description="Weight for lexical scoring")
    semantic_weight: float = Field(default=0.5, ge=0.0, le=1.0, description="Weight for semantic scoring")


class Candidate(BaseModel):
    name: str
    filename: Optional[str] = None
    raw_text: str
    skills: List[str] = []
    experience_years: Optional[int] = None
    education: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    salary: Optional[str] = None
    lexical_score: float
    semantic_score: float
    final_score: float
    lexical_weight_used: float
    semantic_weight_used: float
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    bonus_skills: List[str] = []
    skill_match_percentage: float
    rank: int


class MatchResponse(BaseModel):
    ranked_candidates: List[Candidate]
