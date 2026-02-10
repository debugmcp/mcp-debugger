# tests/adapters/python/integration/env-utils.ts
@source-hash: 809fce482a16bae1
@generated: 2026-02-09T18:14:14Z

## Test Environment Python Configuration Utility

**Primary Purpose**: Ensures Windows CI environments have a functional Python installation with debugpy debugging support available for MCP server integration tests.

**Core Functions**:
- `hasDebugpy(pythonExe)` (L8-19): Validates if a Python installation has debugpy package by spawning `python -m debugpy --version`
- `installDebugpy(pythonExe)` (L21-40): Attempts pip installation of debugpy with `--user --upgrade` flags, returns success status and logs
- `ensurePythonOnPath(env)` (L47-181): Main orchestration function that modifies PATH environment variable to include Python with debugpy

**Architecture**:
- Windows-specific implementation (early return on non-win32 platforms at L48-50)
- Priority-based Python discovery system:
  1. `PYTHONLOCATION` environment variable (L61-69) - typically from GitHub Actions setup-python
  2. Hosted toolcache Python versions (L72-90) - sorted numerically by version for stability
- Fallback chain: prefer existing debugpy → attempt installation → use any available Python

**Key Dependencies**:
- Node.js built-ins: `fs`, `path`, `child_process.spawnSync`
- External processes: Python executable, pip package manager
- Windows filesystem conventions: `C:\hostedtoolcache\windows\Python\{version}\x64`

**Critical Logic Flow**:
1. Parse existing PATH segments with case-insensitive deduplication (L53-55)
2. Discover Python candidates in priority order (L57-90)
3. Test each candidate for debugpy availability (L96-115)
4. If no debugpy found, attempt installation on first available Python (L118-151)
5. Prepend selected Python root and Scripts directory to PATH (L154-180)

**Environment Mutation**:
- Modifies both `env.PATH` and `env.Path` for Windows compatibility (L178-179)
- Uses unshift to prepend directories for precedence (L165)
- Maintains case-insensitive duplicate prevention (L163-164)

**Error Handling**:
- Graceful degradation with diagnostic logging throughout
- Timeouts: 5s for debugpy check, 120s for pip install
- Comprehensive try-catch blocks prevent crashes during discovery/installation

**Testing Context**: Specifically designed for MCP (Model Context Protocol) server spawning in CI environments where Python may be installed but not properly configured for debugging.