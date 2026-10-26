"""Fixtures for the pytest-preset matrix (issue #985 M1)."""
import pytest


@pytest.fixture
def plan():
    return "monthly"


@pytest.fixture
def broken_fixture():
    raise RuntimeError("fixture setup failed")
