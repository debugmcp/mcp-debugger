"""Fixture for issue #1254: writes two lines to stderr and exits with code 3.

Uses sys.__stderr__ + os._exit(3) so debugpy's launcher pipes flush the two
stderr lines and report exit code 3 without raising a user-code SystemExit
under the default 'uncaught' exception filter.
"""
import os
import sys

stream = sys.__stderr__ if sys.__stderr__ is not None else sys.stderr
stream.write("runner error: no test files found\n")
stream.write("exiting with code 3\n")
stream.flush()
os._exit(3)
