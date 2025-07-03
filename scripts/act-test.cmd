@echo off
REM Act test runner script for Windows
REM This script simplifies running tests with Act locally

echo MCP Debugger - Act Test Runner
echo ==============================
echo.

if "%1"=="" goto show_help

if "%1"=="ci" goto run_ci
if "%1"=="release" goto run_release
if "%1"=="e2e" goto run_e2e
if "%1"=="help" goto show_help

echo Invalid option: %1
goto show_help

:run_ci
echo Running CI workflow tests...
act -j build-and-test --matrix os:ubuntu-latest
goto end

:run_release
echo Running Release workflow tests...
act -W .github/workflows/release.yml -j build-and-test
goto end

:run_e2e
echo Running only E2E tests in CI workflow...
act -j build-and-test --matrix os:ubuntu-latest -e "{\"test_filter\":\"e2e\"}"
goto end

:show_help
echo Usage: act-test.cmd [option]
echo.
echo Options:
echo   ci       - Run CI workflow tests (default)
echo   release  - Run Release workflow tests
echo   e2e      - Run only E2E tests
echo   help     - Show this help message
echo.
echo Examples:
echo   act-test.cmd ci
echo   act-test.cmd e2e
echo.
echo Note: Make sure you've built the Docker image first:
echo   docker build -t mcp-debugger:local .
echo.
goto end

:end
