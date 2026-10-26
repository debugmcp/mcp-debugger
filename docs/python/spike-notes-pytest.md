# pytest preset — spike notes (issue #985, M1)

The measured facts behind the `testRunner: "pytest"` preset: what debugpy's exception filters do to a pytest run, which stops land where, and what the preset must pass or avoid. Read [docs/python/README.md](README.md) for how to use the preset; this file is why it is shaped the way it is.

Measured 2026-10-25 on Windows 11, Python 3.13.12 (the `sys.monitoring` tracing path), debugpy 1.8.20, pytest 9.0.3, mcp-debugger at `552c5335` (the #985 M0 module launch) through the dev proxy. The fixture project is `tests/fixtures/python/pytest-project/` (`pytest.ini` with `testpaths = tests`; `billing/proration.py` as the code under test; `tests/test_billing.py` as the matrix, one test per shape). Launch: `dapLaunchArgs: { module: "pytest", cwd: <project> }`, `args: [<abs test file>[::<test>], …]`. The CI lane runs Python 3.11, where pydevd's exception machinery is the frame-tracing implementation rather than `sys.monitoring`; the integration test measures that path on every run.

## Why `uncaught` alone never pauses on a failing test

debugpy's `uncaught` filter means "break when the process is exiting due to an unhandled exception". pytest catches every test failure (`CallInfo.from_call`), so under the launch default the program runs to completion with exit code 1 and the debugger never stops. The two other filters debugpy offers:

- `raised` (the `"all"` mode's half): break at every raise in user code, caught or not — with `justMyCode` on, pydevd excludes exceptions *raised in* library code.
- `userUnhandled` ("User Uncaught Exceptions", `default: false` in debugpy's capability list): break when an exception escapes user code into library code — the pytest shape exactly.

## `breakOnExceptions: "all"` as a baseline — rejected

| test | what happened |
|---|---|
| `test_assert_fails` | first stop = the failing assert (`test_billing.py:16`), locals live; no earlier stop from pytest's own internals |
| `test_raises_in_body` (passes) | **false stop** at the expected `raise ValueError("expected")` inside `pytest.raises` |
| `test_raises_around_helper` (passes) | **false stop** at the raise site (`proration.py:7`), then **another** one frame up (`proration.py:11`) for the same exception — `raised` fires in every user frame the exception passes through |

Two passing tests, three false stops. Not a usable default.

## `userUnhandled` beside `uncaught` — the preset's filters

Whole file in one run (no `-x`), filters `['uncaught', 'userUnhandled']`, `justMyCode: true`. 13 tests, 8 stops: 6 failures, 1 fixture error, 1 skip. 0 stops on the 5 passing tests.

| test | stop? | where the answer lands | notes |
|---|---|---|---|
| `test_passes` | no | — | |
| `test_assert_fails` | yes | `:16`, the assert, test frame | locals `expected`, `plan`, `remaining` plus pytest's rewriting temporaries `@py_assert1`, `@py_format3`, `@py_format5`; `description` is pytest's rewritten message (`assert 20.0 == 21.0`) |
| `test_assert_in_helper` | yes | `proration.py:16`, the raise site inside `check_positive` | pydevd shows the traceback frames *above* the live frame, locals readable (`value = -1`); the test frame is below it, marked `(Current frame)`. The helper is not lost |
| `test_raises_in_body` | no | — | the `with` block handles it inside the test frame |
| `test_raises_around_helper` | no | — | the `KeyError` unwinds through user frames only and is handled in the test frame |
| `test_skip` | yes | `:34`, `pytest.skip(...)` | type `Skipped`, message `not today`. Expected noise: pytest's outcome exceptions are raised in library code but unwind out of the test frame. One `continue` moves on; a targeted run of one test only meets it when that test skips |
| `test_fixture_raises` | yes | `conftest.py:12`, in the fixture | a fixture error pauses where it is raised |
| `test_key_error_escapes` | yes | `proration.py:7`, the raise site | one stop with the full three-frame traceback (`days_in` → `prorate` → the test); `all` stopped twice for the same exception |
| `test_param[0]`, `[15]` | no | — | |
| `test_param[31]` | yes | `:47` | locals `used = 31`; multi-line rewritten message (`assert -1.0 >= 0\n +  where -1.0 = prorate(30, 31, 'monthly')`) |
| `test_decorated` (user decorator) | yes | `:60`, the assert | the live frame is the wrapper (`:53`, `(Current frame)`); the answer's location and frame 0 are the test's assert |
| `test_prints_then_fails` | yes | `:65` | see output capture below |

After the last `continue`: exit code 1, and pytest's full report (FAILURES, ERRORS, `Captured stdout call`, the short summary) lands in `get_output`.

### What debugpy puts on the wire for these stops

- `stopped.reason = "exception"`, `exceptionInfo.breakMode = "always"` (pydevd reports a caught-type stop as `always`, never `userUnhandled`).
- `stopped.text`, `exceptionInfo.exceptionId` and `details.typeName` all carry a pydevd suffix: `AssertionError       (note: full exception trace is shown but execution is paused at: test_assert_fails)`. Left alone it leaks into `snapshot.exception.type`; the preset work strips it.
- The live frame's name carries ` (Current frame)` (also in the `stackTrace` text).
- `exceptionInfo.description` / `details.message` is the exception message — for an assert, pytest's rewritten explanation.

### `justMyCode: false`

Still stops at the assert: pydevd's user-uncaught test forces the project-scope check (`apply_files_filter(..., force_check_project_scope=True)`), so the filter is independent of `justMyCode`. The snapshot's frames then include pytest's `pytest_pyfunc_call` and pluggy's `_multicall` below the test frame.

## Output capture

While paused at `test_prints_then_fails`, `get_output` holds pytest's header (`collected 13 items`, `rootdir`, `configfile`) and the live progress letters (`.FF..sEF..FF`) but **not** the test's `print("before the assert")`: pytest's fd capture keeps it until the report, where it appears under `Captured stdout call` after the run ends. `-s` would surface prints live; the preset does not force it (`args: ["-s"]` opts in), since the snapshot's locals are the live view and `-s` changes what `capsys`-shaped tests see.

## Plugins

Measured with a scratch venv (pytest 9.1.1, pytest-xdist 3.8.0, pytest-cov 7.1.0, debugpy 1.8.22) as the session's `executablePath`.

- **xdist** (`-n 2`): no stop, exit code 3. pytest prints `created: 2/2 workers`, then execnet's `subprocess.Popen(args, stdout=PIPE, stdin=PIPE)` fails in `_make_inheritable(errwrite)` with `OSError: [WinError 6] The handle is invalid`. Root cause: the debuggee runs under `pythonw.exe` on Windows (the adapter's win32 swap, #215, reaches the debuggee because debugpy's launch `python` defaults to the adapter's `sys.executable`), whose Win32 standard handles are invalid — a general hazard filed separately. Even where workers spawn, they run undebugged, so a stop could never land. The preset passes `-p no:xdist`.
- **coverage** (`--cov=billing`, 3.13): the stop lands, the coverage report is correct (88%), no warning — pydevd and coverage 7.x register different `sys.monitoring` tool ids. On ≤3.11 both install a trace function; unmeasured here. The preset passes `-p no:cov` as the safe default.
- `-p no:xdist -p no:cov` is silent when the plugin is absent (probe on a one-test project without either) and disables it cleanly when present (the failing assert still stops) — **as long as nothing else enables the plugin**. The review of #994 measured the gap: a project whose `pytest.ini` has `addopts = --cov=billing --cov-report=term` (or `addopts = -n 2`) with the plugin installed exits 4 under `-p no:cov` / `-p no:xdist` — `error: unrecognized arguments: --cov=billing …` — because the disabled plugin no longer registers its options. Re-measured with the fix: the same project runs with the plugin's own inert switch appended instead (`--no-cov`; `-n0`), so the options parse and the run stays in-process. The preset therefore reads the config file's `addopts` it already found: a plugin the caller's `args` ask for is left alone; one `addopts` turns on gets its inert switch; otherwise `-p no:<plugin>`.

## Decisions the preset takes from this

1. Filters: `uncaught` + `userUnhandled` under the `"uncaught"` default for a pytest module launch; `"all"` and `"none"` unchanged.
2. Args: `<abs test file>[::<selector>]`, `-x`, then per plugin `-p no:xdist` / `-p no:cov` — or `-n0` / `--no-cov` when the project's `addopts` turns the plugin on, nothing when the caller's args ask for it — then the caller's `args`.
3. `cwd`: pytest's rootdir by pytest's own rule (nearest ancestor with `pytest.ini`/`.pytest.ini`, a `pyproject.toml` with `[tool.pytest.ini_options]`, a `tox.ini` with `[pytest]` or a `setup.cfg` with `[tool:pytest]`; else the nearest `setup.py`), else the top-most `conftest.py` ancestor, else the test file's directory — because `python -m` puts `cwd` on `sys.path`. A bare `pyproject.toml` (build metadata only) does not count, as it does not for pytest.
4. Strip pydevd's `(note: full exception trace …)` suffix from the exception type in the snapshot and the stop record; keep the frame-name marker as debugpy reports it.
5. Document: the skip stop, the `(Current frame)` marker, output capture, and that the raise site is frame 0 even when it has already unwound.
