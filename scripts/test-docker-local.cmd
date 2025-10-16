@echo off
REM Docker Smoke Test Runner for Windows
REM Runs the Docker smoke tests locally to verify containerized debugging

echo =====================================
echo   Docker Smoke Test Runner
echo =====================================
echo.

REM Get the project root directory
set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."

cd /d "%ROOT_DIR%"

REM Check if Docker is running
echo Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker and try again.
    exit /b 1
)
echo [OK] Docker is running
echo.

REM Build the project first
echo Building the project...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    exit /b 1
)
echo [OK] Build successful
echo.

REM Build the Docker image
echo Building Docker image...
docker build -t mcp-debugger:test .
if errorlevel 1 (
    echo [ERROR] Docker build failed
    exit /b 1
)
echo [OK] Docker image built
echo.

REM Clean up any existing test containers
echo Cleaning up old test containers...
for /f "tokens=1" %%i in ('docker ps -a ^| findstr mcp-debugger-test') do docker rm -f %%i >nul 2>&1
echo [OK] Cleanup complete
echo.

REM Run the tests
echo =====================================
echo   Running Docker Smoke Tests
echo =====================================
echo.

REM Track test results
set PYTHON_RESULT=0
set JS_RESULT=0

REM Run Python tests
echo Running Python Docker tests...
echo -------------------------------------
call npx vitest run tests/e2e/docker/docker-smoke-python.test.ts --reporter=verbose
set PYTHON_RESULT=%ERRORLEVEL%
echo.

REM Run JavaScript tests
echo Running JavaScript Docker tests...
echo -------------------------------------
call npx vitest run tests/e2e/docker/docker-smoke-javascript.test.ts --reporter=verbose
set JS_RESULT=%ERRORLEVEL%
echo.

REM Summary
echo =====================================
echo   Test Results Summary
echo =====================================
echo.

if %PYTHON_RESULT%==0 (
    echo [PASS] Python Docker tests: PASSED
) else (
    echo [FAIL] Python Docker tests: FAILED
)

if %JS_RESULT%==0 (
    echo [PASS] JavaScript Docker tests: PASSED
) else (
    echo [FAIL] JavaScript Docker tests: FAILED
    echo        (This is expected - JavaScript debugging in Docker has a known regression)
)

echo.
echo =====================================

REM Expected state before fix:
REM - Python should PASS
REM - JavaScript should FAIL
REM This confirms our tests are working properly

if %PYTHON_RESULT%==0 if %JS_RESULT% NEQ 0 (
    echo [INFO] Tests are in expected state: Python works, JavaScript has known regression
    echo.
    echo Next steps:
    echo 1. Fix JavaScript adapter for Docker environment
    echo 2. Run this script again - both should pass after fix
    exit /b 0
)

if %PYTHON_RESULT%==0 if %JS_RESULT%==0 (
    echo [SUCCESS] All Docker tests passed! The regression has been fixed.
    exit /b 0
)

echo [ERROR] Unexpected test results - please investigate
exit /b 1
