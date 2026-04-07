import json
import re
import httpx
from app.models import PositionProfile, EvaluationResult

OLLAMA_URL = "http://localhost:11434/api/generate"
REQUEST_TIMEOUT = 120.0


def _build_prompt(profile: PositionProfile, applicant_name: str, application_text: str, resume_text: str) -> str:
    criteria_list = "\n".join(
        f"  - [{c.weight}/10 weight] {c.name}: {c.description}"
        for c in profile.criteria
    )

    prompt = f"""You are an impartial, fair-minded application screener assisting human reviewers.
Your job is to evaluate applicant alignment with a position based on weighted criteria.
You must be fair, avoid bias, and focus ONLY on the provided text content.
This is a preliminary screening tool to help human reviewers prioritize their time — NOT a final decision.

---
POSITION: {profile.name}
JOB DESCRIPTION:
{profile.job_description}

---
WEIGHTED EVALUATION CRITERIA (weight is 1-10, higher = more important):
{criteria_list}

---
APPLICANT NAME: {applicant_name}

APPLICATION CONTENT (form responses, answers, etc.):
{application_text if application_text.strip() else "(No application text provided)"}

RESUME / CV:
{resume_text if resume_text.strip() else "(No resume provided)"}

---
INSTRUCTIONS:
Evaluate this applicant's alignment with the position using the weighted criteria above.
For each criterion, assess how well the applicant demonstrates alignment based ONLY on what is written.
Compute an overall alignment score from 0 to 100, where:
  - 0-39: Poor fit — significant gaps in key areas
  - 40-69: Moderate fit — some alignment, notable gaps
  - 70-84: Good fit — strong alignment with most criteria
  - 85-100: Excellent fit — strong alignment across all weighted criteria

Respond ONLY with valid JSON in exactly this format, no other text:
{{
  "score": <integer 0-100>,
  "summary": "<2-3 sentence plain English explanation of the score, citing specific evidence from the application>",
  "criteria_breakdown": [
    {{"criterion": "<name>", "weight": <weight>, "assessment": "<1 sentence assessment>", "alignment": "<low|moderate|high>"}}
  ]
}}"""
    return prompt


def _extract_json(text: str) -> dict:
    """Try to extract a JSON object from LLM output, which may have extra text."""
    # Try direct parse first
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Look for JSON block in markdown fences
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    # Find the first { ... } block
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from LLM response: {text[:500]}")


async def evaluate_application(
    profile: PositionProfile,
    applicant_name: str,
    application_text: str,
    resume_text: str,
) -> EvaluationResult:
    prompt = _build_prompt(profile, applicant_name, application_text, resume_text)

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": profile.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 1024,
                    },
                },
            )
            response.raise_for_status()
            body = response.json()
            raw_text = body.get("response", "")
    except httpx.ConnectError:
        raise ConnectionError(
            "Could not connect to Ollama at localhost:11434. "
            "Make sure Ollama is running (run: ollama serve)."
        )
    except httpx.TimeoutException:
        raise TimeoutError(
            f"Ollama request timed out after {REQUEST_TIMEOUT}s. "
            "The model may be too large — consider a smaller model."
        )

    parsed = _extract_json(raw_text)

    # Validate and clamp score
    score = max(0, min(100, int(parsed.get("score", 50))))
    summary = parsed.get("summary", "No summary provided.")
    criteria_breakdown = parsed.get("criteria_breakdown", [])

    # Ensure breakdown has all criteria if LLM skipped some
    if not criteria_breakdown:
        criteria_breakdown = [
            {"criterion": c.name, "weight": c.weight, "assessment": "Not assessed.", "alignment": "moderate"}
            for c in profile.criteria
        ]

    return EvaluationResult(
        score=score,
        summary=summary,
        criteria_breakdown=criteria_breakdown,
        applicant_name=applicant_name,
        profile_name=profile.name,
    )
