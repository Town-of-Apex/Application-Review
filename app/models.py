from pydantic import BaseModel, Field
from typing import Optional
import uuid


class Criterion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    weight: int = Field(default=5, ge=1, le=10)


class PositionProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    job_description: str
    criteria: list[Criterion] = []
    ollama_model: str = "gemma3:1b"


class EvaluationResult(BaseModel):
    score: int
    summary: str
    criteria_breakdown: list[dict]
    applicant_name: str
    profile_name: str
