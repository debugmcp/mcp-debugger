"""The pytest-preset matrix (issue #985 M1). The integration test pins line numbers in this file."""
import functools

import pytest

from billing.proration import check_positive, prorate


def test_passes(plan):
    assert prorate(30, 10, plan) == 20.0


def test_assert_fails(plan):
    remaining = prorate(30, 10, plan)
    expected = 21.0
    assert remaining == expected  # line 16: the failing assert, in the test frame


def test_assert_in_helper():
    check_positive(-1)  # line 20: the assert is in billing.proration.check_positive


def test_raises_in_body():
    with pytest.raises(ValueError):
        raise ValueError("expected")


def test_raises_around_helper():
    with pytest.raises(KeyError):
        prorate(30, 1, "weekly")


def test_skip():
    pytest.skip("not today")  # line 34


def test_fixture_raises(broken_fixture):
    assert broken_fixture is None


def test_key_error_escapes():
    assert prorate(30, 1, "weekly") == 0  # line 42: KeyError raised two frames down


@pytest.mark.parametrize("used", [0, 15, 31])
def test_param(used, plan):
    assert prorate(30, used, plan) >= 0  # line 47: fails for used=31


def logged(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)  # line 53

    return wrapper


@logged
def test_decorated():
    assert 1 == 2  # line 60


def test_prints_then_fails():
    print("before the assert")
    assert False, "after the print"  # line 65
