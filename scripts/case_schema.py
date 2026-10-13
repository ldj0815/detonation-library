"""Validation for one case row.

`Case` holds the 30 data fields and their rules (ported from the old server's
CaseCreate). `StoredCase` adds the two columns that exist only in
data/cases.csv: `id` and `created_at`.
"""
import math
from datetime import datetime, timezone
from enum import Enum

from pydantic import (
    BaseModel,
    EmailStr,
    ValidationError,
    ValidationInfo,
    field_validator,
    model_validator,
)


class SetupType(str, Enum):
    detonation = "detonation"
    rde = "rde"


# Column order of the 30 data fields.
CASE_FIELDS = (
    "title", "setup", "geometry", "fuel", "oxidizer",
    "equivalence_ratio", "initial_pressure_kpa", "initial_temperature_k",
    "primary_diluent_name", "primary_diluent_percentage", "additional_diluents",
    "primary_dopant_name", "primary_dopant_ppm", "additional_dopants",
    "cell_width_mm", "cell_width_uncertainty_mm",
    "cell_length_mm", "cell_length_uncertainty_mm",
    "critical_hydraulic_diameter_mm", "minimum_hydraulic_diameter_mm",
    "critical_energy_j", "tube_radius_mm", "chamber_width_mm", "chamber_height_mm",
    "contributor_name", "contributor_institution", "contributor_email",
    "doi_reference", "sharing_link", "notes",
)

# Column order of data/cases.csv.
STORED_COLUMNS = ("id",) + CASE_FIELDS + ("created_at",)

NUMERIC_FIELDS = (
    "equivalence_ratio", "initial_pressure_kpa", "initial_temperature_k",
    "primary_diluent_percentage", "primary_dopant_ppm",
    "cell_width_mm", "cell_width_uncertainty_mm",
    "cell_length_mm", "cell_length_uncertainty_mm",
    "critical_hydraulic_diameter_mm", "minimum_hydraulic_diameter_mm",
    "critical_energy_j", "tube_radius_mm", "chamber_width_mm", "chamber_height_mm",
)

OPTIONAL_TEXT_FIELDS = (
    "primary_diluent_name", "additional_diluents",
    "primary_dopant_name", "additional_dopants",
    "doi_reference", "sharing_link", "notes",
)

_BLANK_MEANS_NONE = frozenset(NUMERIC_FIELDS + OPTIONAL_TEXT_FIELDS)


class Case(BaseModel):
    title: str
    setup: SetupType
    geometry: str
    fuel: str
    oxidizer: str
    equivalence_ratio: float | None = None
    initial_pressure_kpa: float | None = None
    initial_temperature_k: float | None = None
    primary_diluent_name: str | None = None
    primary_diluent_percentage: float | None = None
    additional_diluents: str | None = None
    primary_dopant_name: str | None = None
    primary_dopant_ppm: float | None = None
    additional_dopants: str | None = None
    cell_width_mm: float | None = None
    cell_width_uncertainty_mm: float | None = None
    cell_length_mm: float | None = None
    cell_length_uncertainty_mm: float | None = None
    critical_hydraulic_diameter_mm: float | None = None
    minimum_hydraulic_diameter_mm: float | None = None
    critical_energy_j: float | None = None
    tube_radius_mm: float | None = None
    chamber_width_mm: float | None = None
    chamber_height_mm: float | None = None
    contributor_name: str
    contributor_institution: str
    contributor_email: EmailStr
    doi_reference: str | None = None
    sharing_link: str | None = None
    notes: str | None = None

    @field_validator(
        "title", "geometry", "fuel", "oxidizer",
        "contributor_name", "contributor_institution",
    )
    @classmethod
    def validate_required_text(cls, v: str, info: ValidationInfo) -> str:
        v = v.strip()
        if not v:
            raise ValueError(f"{info.field_name} must not be empty")
        return v

    @field_validator(*NUMERIC_FIELDS)
    @classmethod
    def validate_finite(cls, v: float | None, info: ValidationInfo) -> float | None:
        if v is not None and not math.isfinite(v):
            raise ValueError(f"{info.field_name} must be a finite number")
        return v

    @field_validator("equivalence_ratio")
    @classmethod
    def validate_equivalence_ratio(cls, v: float | None) -> float | None:
        if v is not None and not 0.01 <= v <= 100.0:
            raise ValueError("equivalence_ratio must be between 0.01 and 100.0")
        return v

    @field_validator("initial_pressure_kpa")
    @classmethod
    def validate_pressure(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("initial_pressure_kpa must be positive")
        return v

    @field_validator("initial_temperature_k")
    @classmethod
    def validate_temperature(cls, v: float | None) -> float | None:
        if v is not None and not 50.0 <= v <= 5000.0:
            raise ValueError("initial_temperature_k must be between 50 and 5000")
        return v

    @model_validator(mode="after")
    def validate_diluent_pair(self) -> "Case":
        # A diluent name without a percentage is allowed; a percentage without
        # a name is not.
        if self.primary_diluent_percentage is not None and self.primary_diluent_name is None:
            raise ValueError("primary_diluent_percentage requires primary_diluent_name")
        return self


class StoredCase(Case):
    id: int
    created_at: datetime

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: int) -> int:
        if v < 1:
            raise ValueError("id must be a positive integer")
        return v

    @field_validator("created_at")
    @classmethod
    def normalise_created_at(cls, v: datetime) -> datetime:
        # Stored timestamps are UTC; a value without a zone is taken as UTC.
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


def clean_row(row: dict[str, str | None]) -> dict[str, str | None]:
    """Turn raw CSV cells into model input: trim every cell and turn a blank
    optional cell into None. A blank required cell stays "" so the model
    reports it with its own message."""
    cleaned: dict[str, str | None] = {}
    for key, value in row.items():
        text = (value or "").strip()
        cleaned[key] = None if text == "" and key in _BLANK_MEANS_NONE else text
    return cleaned


def error_lines(exc: ValidationError) -> list[str]:
    """One short line per problem, for example
    'equivalence_ratio: Value error, equivalence_ratio must be between 0.01 and 100.0'."""
    lines = []
    for err in exc.errors():
        where = ".".join(str(part) for part in err["loc"]) or "row"
        lines.append(f"{where}: {err['msg']}")
    return lines
