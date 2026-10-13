"""Shared builders for tests."""
from case_schema import StoredCase


def valid_fields(**overrides):
    """The smallest set of fields that makes a valid Case."""
    fields = dict(
        title="Run 1",
        setup="detonation",
        geometry="round tube",
        fuel="H2",
        oxidizer="O2",
        contributor_name="A. Researcher",
        contributor_institution="UCI",
        contributor_email="a.researcher@uci.edu",
    )
    fields.update(overrides)
    return fields


def stored(case_id=1, **overrides):
    return StoredCase(
        id=case_id,
        created_at="2026-04-08T06:30:50.843939Z",
        **valid_fields(**overrides),
    )
