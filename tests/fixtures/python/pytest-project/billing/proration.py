"""Proration helpers: the code under test for the pytest-preset matrix (issue #985 M1)."""

RATES = {"monthly": 30, "yearly": 365}


def days_in(plan: str) -> int:
    return RATES[plan]  # KeyError for an unknown plan


def prorate(amount: float, used_days: int, plan: str) -> float:
    total_days = days_in(plan)
    return round(amount * (total_days - used_days) / total_days, 2)


def check_positive(value: float) -> None:
    assert value > 0, f"expected a positive value, got {value}"
