# scripts/act-test.sh
@source-hash: 6051ecc27d2ff579
@generated: 2026-02-10T00:41:58Z

## Purpose
Shell script that provides a simplified wrapper around Act (GitHub Actions local test runner) for the MCP Debugger project. Enables local testing of GitHub Actions workflows without pushing to remote repository.

## Core Functionality

### Main Script Flow (L27-48)
- **Case statement dispatcher**: Routes execution based on command-line argument
- **Default behavior**: Runs CI workflow if no argument provided (L28)
- **Error handling**: Shows help and exits with code 1 for invalid options (L43-47)

### Command Options
- **`ci` or empty** (L28-31): Executes CI workflow tests targeting ubuntu-latest matrix
- **`release`** (L32-35): Runs release workflow tests from `.github/workflows/release.yml`
- **`e2e`** (L36-39): Executes only E2E tests within CI workflow using test filter
- **`help`** (L40-42): Displays usage information

### Helper Functions
- **`show_help()` (L9-25)**: Comprehensive usage documentation including examples and Docker build prerequisite

## Act Command Patterns
- Uses `-j build-and-test` job targeting across workflows
- Applies `--matrix os:ubuntu-latest` for CI consistency
- Leverages `-e` flag for environment variable injection (E2E filtering)
- Specifies workflow file explicitly with `-W` for release testing

## Dependencies
- **External**: Requires Act CLI tool installed locally
- **Docker**: Assumes `mcp-debugger:local` image exists (referenced in help)
- **Repository structure**: Expects standard `.github/workflows/` directory layout

## Usage Patterns
Script designed for developer workflow automation, reducing friction for local GitHub Actions testing. Provides sensible defaults while exposing key testing scenarios through simple command interface.