# mcp_debugger_launcher/mcp_debugger_launcher/detectors.py
@source-hash: f7b31d12c3a49508
@generated: 2026-02-09T18:15:02Z

## Purpose
Runtime detection utilities for the debug-mcp-server launcher, providing comprehensive environment analysis for Node.js/npm and Docker execution paths.

## Core Architecture
Single static class `RuntimeDetector` (L8-165) implementing detection pattern with separate methods for each runtime component, unified by aggregation functions.

## Key Classes & Methods

### RuntimeDetector (L8-165)
Static utility class providing runtime environment detection capabilities:

- `check_nodejs()` (L11-31): Detects Node.js installation via `shutil.which()` and version extraction through subprocess execution. Returns tuple of (availability, version_string). Includes 5-second timeout protection.

- `check_npx()` (L33-36): Simple binary check for npx availability using `shutil.which()`.

- `check_npm_package(package_name)` (L38-51): Validates npm package accessibility via `npx --no-install` with `--version` flag. Uses 10-second timeout and prevents automatic installation.

- `check_docker()` (L53-95): Comprehensive Docker detection including installation check, version extraction, and daemon status verification. Implements fallback strategy: attempts `docker ping` first, then `docker ps` if ping fails. Returns tuple with daemon status in version string.

- `check_docker_image(image_name)` (L97-109): Local Docker image existence check using `docker images -q` command with output evaluation.

- `detect_available_runtimes()` (L111-150): Orchestrates all detection methods into structured dictionary. Hardcodes specific package name `@debugmcp/mcp-debugger` and image `debugmcp/mcp-debugger:latest`. Implements conditional checking (only checks npx packages if Node.js available, only checks Docker images if daemon running).

- `get_recommended_runtime(runtimes)` (L152-165): Runtime selection logic prioritizing npx over Docker based on availability matrix.

## Dependencies
- `subprocess`: Process execution for version checks and availability testing
- `shutil`: Cross-platform executable detection via `which()`
- `os`: Standard library import (unused in current implementation)
- `typing`: Type hints for Tuple and Optional

## Key Patterns
- **Defensive Programming**: All subprocess calls wrapped in try/except with timeout protection
- **Fallback Strategy**: Docker daemon detection uses multiple verification approaches
- **Binary Detection**: Consistent pattern of executable path checking followed by functional validation
- **Structured Output**: Standardized dictionary format for runtime information aggregation

## Critical Constraints
- Hardcoded timeouts: 5s for version checks, 10s for npm package validation
- Hardcoded package/image names embedded in detection logic
- Docker daemon status detection assumes specific command behaviors
- No caching of detection results across multiple calls