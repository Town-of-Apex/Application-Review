import json
import uuid
from pathlib import Path
from app.models import PositionProfile, Criterion

PROFILES_DIR = Path(__file__).parent.parent / "data" / "profiles"


def _ensure_dir():
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)


def list_profiles() -> list[PositionProfile]:
    _ensure_dir()
    profiles = []
    for f in sorted(PROFILES_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            profiles.append(PositionProfile(**data))
        except Exception:
            pass
    return profiles


def get_profile(profile_id: str) -> PositionProfile | None:
    _ensure_dir()
    path = PROFILES_DIR / f"{profile_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    return PositionProfile(**data)


def save_profile(profile: PositionProfile) -> PositionProfile:
    _ensure_dir()
    path = PROFILES_DIR / f"{profile.id}.json"
    path.write_text(profile.model_dump_json(indent=2))
    return profile


def create_profile(data: dict) -> PositionProfile:
    profile = PositionProfile(**data)
    if not profile.id:
        profile.id = str(uuid.uuid4())
    return save_profile(profile)


def update_profile(profile_id: str, data: dict) -> PositionProfile | None:
    existing = get_profile(profile_id)
    if not existing:
        return None
    updated = existing.model_copy(update=data)
    updated.id = profile_id
    return save_profile(updated)


def delete_profile(profile_id: str) -> bool:
    _ensure_dir()
    path = PROFILES_DIR / f"{profile_id}.json"
    if path.exists():
        path.unlink()
        return True
    return False


def seed_example_profiles():
    """Create example profiles if none exist."""
    _ensure_dir()
    if list(PROFILES_DIR.glob("*.json")):
        return  # Already seeded

    examples = [
        PositionProfile(
            id=str(uuid.uuid4()),
            name="Parks & Recreation Intern",
            description="Summer internship supporting parks programming and community events.",
            job_description=(
                "The Parks & Recreation Intern will assist with planning and executing summer programs, "
                "maintaining event calendars, supporting community engagement initiatives, and performing "
                "general administrative tasks. The ideal candidate is enthusiastic about public service, "
                "comfortable working outdoors, and has strong communication skills."
            ),
            ollama_model="gemma3:1b",
            criteria=[
                Criterion(name="Related Field of Study", description="Studying parks management, recreation, public administration, environmental science, or a closely related field.", weight=7),
                Criterion(name="Community Engagement Experience", description="Prior experience with community outreach, event planning, or volunteer coordination.", weight=8),
                Criterion(name="Communication Skills", description="Demonstrates strong written and verbal communication skills in application materials.", weight=6),
                Criterion(name="Outdoor/Physical Work Comfort", description="Comfortable working outdoors and performing light physical tasks.", weight=5),
                Criterion(name="Availability & Commitment", description="Available for the full internship duration with consistent weekly hours.", weight=7),
            ],
        ),
        PositionProfile(
            id=str(uuid.uuid4()),
            name="Planning & Zoning Intern",
            description="Intern supporting the community planning department with research, GIS, and public meeting prep.",
            job_description=(
                "The Planning Intern will support staff with land use research, zoning analysis, GIS mapping, "
                "comprehensive plan updates, and preparation of materials for public hearings. The ideal candidate "
                "is detail-oriented, has a background in urban planning or geography, and is comfortable with "
                "data analysis and mapping tools."
            ),
            ollama_model="gemma3:1b",
            criteria=[
                Criterion(name="Urban Planning / Geography Background", description="Enrolled in or recently completed a degree in urban planning, geography, public policy, or related field.", weight=9),
                Criterion(name="GIS Experience", description="Familiarity with GIS tools such as ArcGIS or QGIS for spatial data analysis and mapping.", weight=8),
                Criterion(name="Research & Analytical Skills", description="Demonstrated ability to collect, analyze, and summarize data and policy information.", weight=7),
                Criterion(name="Writing & Report Preparation", description="Strong technical writing skills for public documents and staff reports.", weight=6),
                Criterion(name="Attention to Detail", description="Shows carefulness and precision in presented work and application materials.", weight=5),
            ],
        ),
        PositionProfile(
            id=str(uuid.uuid4()),
            name="Youth Advisory Council",
            description="Volunteer youth council position for residents aged 14–21 to advise local government.",
            job_description=(
                "Youth Advisory Council members represent the voices of young residents by attending monthly meetings, "
                "participating in community projects, and providing input to elected officials on matters affecting youth. "
                "Members are expected to be engaged, articulate, and passionate about their community. No prior experience required."
            ),
            ollama_model="gemma3:1b",
            criteria=[
                Criterion(name="Community Passion", description="Expresses genuine interest in local government, community improvement, or civic engagement.", weight=9),
                Criterion(name="Communication & Confidence", description="Articulates thoughts clearly and confidently in written form.", weight=7),
                Criterion(name="Leadership Potential", description="Shows initiative, leadership, or involvement in school or community activities.", weight=8),
                Criterion(name="Diversity of Perspective", description="Brings a unique or underrepresented viewpoint that enriches council discussions.", weight=6),
                Criterion(name="Commitment to Attendance", description="Understands and commits to the expected time commitment for monthly meetings and events.", weight=7),
            ],
        ),
    ]

    for profile in examples:
        save_profile(profile)
