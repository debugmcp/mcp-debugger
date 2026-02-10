# tests/adapters/python/integration/env-utils.ts
@source-hash: 809fce482a16bae1
@generated: 2026-02-10T00:41:10Z

## env-utils.ts

**Purpose**: Utility module for ensuring Python environments with debugpy debugging support are available on PATH, specifically targeting Windows CI environments where Python installations may be present but not properly configured.

### Core Functions

- **hasDebugpy(pythonExe)** (L8-19): Synchronously checks if a Python executable has debugpy installed by running `python -m debugpy --version` with 5-second timeout. Returns boolean result, catching all exceptions as false.

- **installDebugpy(pythonExe)** (L21-40): Attempts to install debugpy via pip with `--user --upgrade` flags. Uses 2-minute timeout and returns installation status plus combined stdout/stderr logs. Handles spawn errors gracefully.

- **ensurePythonOnPath(env)** (L47-181): Main exported function that modifies the provided environment object's PATH to include a Python installation with debugpy. Windows-only operation (early return on other platforms).

### Python Discovery Strategy

The function implements a prioritized search pattern:

1. **Priority 1** (L61-69): Checks `pythonLocation`/`PythonLocation` environment variables (typically set by GitHub Actions setup-python)

2. **Priority 2** (L72-90): Scans `C:\hostedtoolcache\windows\Python` for all versions, sorted numerically (oldest first for stability)

### PATH Management Logic

- Normalizes PATH segments using case-insensitive comparison for Windows (L53-55)
- Adds both Python root directory and `Scripts` subdirectory to PATH (L157-169) 
- Uses `unshift()` to prioritize selected Python at PATH beginning (L165)
- Updates both `PATH` and `Path` environment variables for Windows compatibility (L178-179)

### Fallback Behavior

- If no Python with debugpy found, attempts automatic installation via pip (L118-141)
- If installation fails, falls back to first available Python with warning (L142-151)
- Comprehensive diagnostic logging throughout the discovery process (L94, L119-120)

### Dependencies

- Node.js built-ins: `fs`, `path`, `child_process.spawnSync`
- Designed for Windows CI environments, particularly GitHub Actions hosted runners

### Key Constraints

- Windows-specific implementation (no-op on other platforms)
- Synchronous operations with timeouts (5s for version check, 120s for installation)
- Case-insensitive path handling for Windows filesystem semantics