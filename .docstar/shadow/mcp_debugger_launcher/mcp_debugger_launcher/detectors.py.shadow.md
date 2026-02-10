# mcp_debugger_launcher/mcp_debugger_launcher/detectors.py
@source-hash: f7b31d12c3a49508
@generated: 2026-02-10T00:41:52Z

## Primary Purpose
Provides runtime detection capabilities for the debug-mcp-server launcher, identifying and validating available execution environments (Node.js/npx and Docker) with detailed status reporting.

## Key Components

### RuntimeDetector Class (L8-165)
Static utility class containing all detection methods. No instance state - purely functional approach.

#### Core Detection Methods
- `check_nodejs()` (L12-31): Validates Node.js installation using `shutil.which()` and `subprocess.run()` with version retrieval. Returns tuple of (availability, version_string).
- `check_npx()` (L34-36): Simple binary check for npx availability via PATH lookup.
- `check_npm_package()` (L39-51): Tests npm package accessibility using `npx --no-install {package} --version` with 10s timeout.
- `check_docker()` (L54-95): Comprehensive Docker validation including installation check, version retrieval, and daemon status via both `docker ping` and `docker ps` fallback.
- `check_docker_image()` (L98-109): Verifies local Docker image existence using `docker images -q`.

#### Orchestration Methods
- `detect_available_runtimes()` (L112-150): Main detection orchestrator that builds comprehensive runtime status dictionary. Checks Node.js ecosystem first, then Docker, with conditional package/image checks.
- `get_recommended_runtime()` (L153-165): Decision engine that prioritizes npx over Docker based on availability criteria.

## Dependencies
- `subprocess`: All external command execution with timeout protection
- `shutil`: PATH-based executable discovery via `which()`
- `os`: Standard library import (unused in current implementation)
- `typing`: Type hints for return signatures

## Architecture Patterns
- **Static Methods Only**: No instance state, pure utility class design
- **Defensive Programming**: Extensive try/except blocks with timeout handling for all subprocess calls
- **Structured Returns**: Consistent tuple returns for availability checks, detailed dict for comprehensive status
- **Fallback Logic**: Docker daemon detection uses ping->ps fallback strategy
- **Conditional Checks**: Package/image validation only performed when base runtimes are available

## Critical Invariants
- All subprocess calls use `capture_output=True, text=True` for consistent handling
- Timeout values: 5s for basic checks, 10s for npm package verification
- Docker daemon status distinguished from installation status via version string analysis
- Package detection uses `--no-install` flag to avoid unwanted installations

## Data Flow
RuntimeDetector orchestrates a two-phase detection:
1. Base runtime availability (Node.js/Docker installation + basic functionality)
2. Ecosystem readiness (npx packages, Docker images) - only if base runtimes are functional

The recommendation engine implements a preference hierarchy: npx (if Node.js + npx available) > Docker (if daemon running) > None.