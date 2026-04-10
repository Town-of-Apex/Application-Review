import json
import re
import httpx
import os
from app.models import PositionProfile, EvaluationResult

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_URL = f"{OLLAMA_BASE_URL}/api/generate"
REQUEST_TIMEOUT = 120.0


def _build_prompt(profile: PositionProfile, applicant_name: str, application_text: str, resume_text: str) -> str:
    criteria_list = "\n".join(
        f"  - [{c.weight}/10 weight] {c.name}: {c.description}"
        for c in profile.criteria
    )

    prompt = f"""You are an opinionated but fair application screener assisting human reviewers.
Your goal is to help prioritize candidates by making clear, decisive judgments — not to avoid risk.

This is a screening tool, not a final decision maker.

---

POSITION: {profile.name}
JOB DESCRIPTION:
{profile.job_description}

---

WEIGHTED EVALUATION CRITERIA (weight is 1-10, higher = more important):
{criteria_list}

---

APPLICANT NAME: {applicant_name}

APPLICATION CONTENT:
{application_text if application_text.strip() else "(No application text provided)"}

RESUME / CV:
{resume_text if resume_text.strip() else "(No resume provided)"}

---

EVALUATION PRINCIPLES:

1. INFER REASONABLY:
Do not rely only on exact keyword matches. If the applicant demonstrates a skill or trait indirectly, count it.
Example: Leading a club implies leadership and initiative, even if not explicitly labeled.

2. ABSENCE IS SIGNAL:
If an important criterion has little or no supporting evidence, treat that as a meaningful gap — not a neutral.

3. BE DECISIVE:
Avoid defaulting to middle scores. Most applicants should clearly fall into either strong or weak alignment.
Use the full scoring range.

4. WEIGHT MATTERS:
Heavily weighted criteria should significantly impact the final score.

5. EVIDENCE OVER GENEROSITY:
Do not assume qualifications without support. Inference should be reasonable, not optimistic guessing.

6. COMPARE TO A STRONG APPLICANT:
Implicitly compare this applicant to a highly competitive candidate for this role.

---

SCORING GUIDELINES:

- 0–39: Clear poor fit — lacks multiple critical criteria
- 40–59: Weak fit — limited or inconsistent alignment
- 60–74: Decent fit — meets some important criteria but with gaps
- 75–89: Strong fit — meets most criteria with solid evidence
- 90–100: Exceptional fit — clear, compelling alignment across key areas

Do NOT inflate scores. Only assign 85+ if the candidate would stand out in a competitive pool.

---

OUTPUT FORMAT (STRICT JSON ONLY):

{{
  "score": <integer 0-100>,
  "summary": "<2-3 sentence explanation citing specific evidence AND key gaps>",
  "criteria_breakdown": [
    {{
      "criterion": "<name>",
      "weight": <weight>,
      "assessment": "<clear, direct judgment with evidence or noted absence>",
      "alignment": "<low|moderate|high>"
    }}
  ]
}}
"""
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
            f"Could not connect to Ollama at {OLLAMA_BASE_URL}. "
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
