from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from case_schema import (
    CASE_FIELDS,
    STORED_COLUMNS,
    Case,
    StoredCase,
    clean_row,
    error_lines,
)
from helpers import stored, valid_fields

REQUIRED_TEXT = [
    "title", "geometry", "fuel", "oxidizer",
    "contributor_name", "contributor_institution",
]


def test_valid_case_coerces_numbers_from_text():
    case = Case(**valid_fields(equivalence_ratio="1.5", cell_width_mm="14"))
    assert case.equivalence_ratio == 1.5
    assert case.cell_width_mm == 14.0
    assert case.setup.value == "detonation"
    assert case.notes is None


def test_invalid_setup_rejected():
    with pytest.raises(ValidationError):
        Case(**valid_fields(setup="shock_tube"))


@pytest.mark.parametrize("value", [0.01, 1, 100])
def test_equivalence_ratio_accepts_bounds(value):
    assert Case(**valid_fields(equivalence_ratio=value)).equivalence_ratio == value


@pytest.mark.parametrize("value", [0.001, 100.5, -1])
def test_equivalence_ratio_rejects_out_of_range(value):
    with pytest.raises(ValidationError, match="equivalence_ratio must be between"):
        Case(**valid_fields(equivalence_ratio=value))


@pytest.mark.parametrize("value", [0, -5])
def test_pressure_must_be_positive(value):
    with pytest.raises(ValidationError, match="initial_pressure_kpa must be positive"):
        Case(**valid_fields(initial_pressure_kpa=value))


@pytest.mark.parametrize("value", [49.9, 5000.1])
def test_temperature_bounds(value):
    with pytest.raises(ValidationError, match="initial_temperature_k must be between"):
        Case(**valid_fields(initial_temperature_k=value))


def test_diluent_percentage_requires_name():
    with pytest.raises(ValidationError, match="requires primary_diluent_name"):
        Case(**valid_fields(primary_diluent_percentage=50))


def test_diluent_name_without_percentage_allowed():
    case = Case(**valid_fields(primary_diluent_name="N2"))
    assert case.primary_diluent_percentage is None


@pytest.mark.parametrize("value", ["nan", "inf", "-inf"])
def test_non_finite_numbers_rejected(value):
    with pytest.raises(ValidationError, match="must be a finite number"):
        Case(**valid_fields(cell_width_mm=value))


def test_text_that_is_not_a_number_rejected():
    with pytest.raises(ValidationError):
        Case(**valid_fields(cell_width_mm="about 14"))


@pytest.mark.parametrize("field", REQUIRED_TEXT)
@pytest.mark.parametrize("blank", ["", "   "])
def test_required_text_must_not_be_blank(field, blank):
    with pytest.raises(ValidationError, match=f"{field} must not be empty"):
        Case(**valid_fields(**{field: blank}))


def test_required_text_is_trimmed():
    assert Case(**valid_fields(title="  Run 1  ")).title == "Run 1"


def test_bad_email_rejected():
    with pytest.raises(ValidationError):
        Case(**valid_fields(contributor_email="not-an-email"))


def test_stored_case_parses_id_and_timestamp():
    case = stored(7)
    assert case.id == 7
    assert case.created_at == datetime(2026, 4, 8, 6, 30, 50, 843939, tzinfo=timezone.utc)


@pytest.mark.parametrize("bad_id", [0, -3, "abc", ""])
def test_stored_case_rejects_bad_id(bad_id):
    with pytest.raises(ValidationError):
        StoredCase(id=bad_id, created_at="2026-04-08T06:30:50Z", **valid_fields())


def test_stored_case_timestamp_is_normalised_to_utc():
    with_zone = StoredCase(id=1, created_at="2026-04-08T08:30:00+02:00", **valid_fields())
    without_zone = StoredCase(id=1, created_at="2026-04-08T06:30:00", **valid_fields())
    expected = datetime(2026, 4, 8, 6, 30, tzinfo=timezone.utc)
    assert with_zone.created_at == expected
    assert with_zone.created_at.utcoffset().total_seconds() == 0
    assert without_zone.created_at == expected


def test_clean_row_trims_and_blanks_optional_cells():
    cleaned = clean_row({
        "title": "  Run 1 ",
        "fuel": "",
        "notes": "   ",
        "cell_width_mm": "",
        "equivalence_ratio": " 1.0 ",
        "geometry": None,
        "doi_reference": None,
    })
    assert cleaned == {
        "title": "Run 1",
        "fuel": "",            # required: stays "" so the model reports it
        "notes": None,
        "cell_width_mm": None,
        "equivalence_ratio": "1.0",
        "geometry": "",
        "doi_reference": None,
    }


def test_error_lines_name_the_field():
    with pytest.raises(ValidationError) as caught:
        Case(**valid_fields(equivalence_ratio=500, fuel=""))
    lines = error_lines(caught.value)
    assert "fuel: Value error, fuel must not be empty" in lines
    assert "equivalence_ratio: Value error, equivalence_ratio must be between 0.01 and 100.0" in lines


def test_error_lines_for_a_whole_row_rule():
    with pytest.raises(ValidationError) as caught:
        Case(**valid_fields(primary_diluent_percentage=50))
    assert error_lines(caught.value) == [
        "row: Value error, primary_diluent_percentage requires primary_diluent_name"
    ]


def test_column_lists():
    assert len(CASE_FIELDS) == 30
    assert len(set(CASE_FIELDS)) == 30
    assert STORED_COLUMNS == ("id",) + CASE_FIELDS + ("created_at",)
    assert set(Case.model_fields) == set(CASE_FIELDS)
    assert set(StoredCase.model_fields) == set(STORED_COLUMNS)
