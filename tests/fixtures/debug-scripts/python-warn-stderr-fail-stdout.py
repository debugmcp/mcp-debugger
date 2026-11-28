import sys
import warnings

warnings.warn("legacy config flag used", DeprecationWarning, stacklevel=1)
print("FAILED tests/test_auth.py::test_login - AssertionError: expected 200, got 401", flush=True)
sys.exit(1)
