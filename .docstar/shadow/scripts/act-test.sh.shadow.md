# scripts/act-test.sh
@source-hash: 6051ecc27d2ff579
@generated: 2026-02-09T18:15:09Z

**Purpose:** Shell script wrapper for running GitHub Actions workflows locally using Act, specifically designed for MCP Debugger project testing.

**Core Functionality:**
- `show_help()` (L9-25): Displays usage instructions and examples for the script
- Main command dispatcher (L27-48): Case statement handling different test execution modes

**Supported Operations:**
- **ci** (L28-31): Default mode, runs CI workflow with Ubuntu matrix using `act -j build-and-test --matrix os:ubuntu-latest`
- **release** (L32-35): Executes release workflow tests targeting specific workflow file
- **e2e** (L36-39): Runs only end-to-end tests by passing test filter event data
- **help** (L40-42): Shows usage documentation
- Invalid option handling (L43-47): Error message and help display with exit code 1

**Dependencies:**
- Requires `act` CLI tool for local GitHub Actions execution
- Expects Docker image `mcp-debugger:local` to be pre-built
- Relies on `.github/workflows/release.yml` workflow file

**Key Parameters:**
- Uses Ubuntu-latest matrix for CI testing
- Passes JSON event data for E2E test filtering
- Targets specific workflow jobs (`build-and-test`)

**Usage Pattern:** Single command-line argument dispatcher with sensible defaults (empty arg defaults to CI mode).