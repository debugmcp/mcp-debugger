@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Debug MCP Server - SSE Launcher
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not found in PATH!
    pause
    exit /b 1
)
echo [OK] Node.js is available

REM Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not found in PATH!
    pause
    exit /b 1
)
echo [OK] Python is available

REM Check debugpy
python -c "import debugpy" 2>nul
if %errorlevel% neq 0 (
    echo ERROR: debugpy module is not installed!
    echo Please run: python -m pip install debugpy
    pause
    exit /b 1
)
echo [OK] debugpy is available

echo.
echo Environment checks passed!
echo.
echo Starting Debug MCP Server in SSE mode...
echo Server will be available at: http://localhost:3001/sse
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start the server
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "DIST_PATH=%ROOT_DIR%\dist\index.js"
set "LOG_DIR=%ROOT_DIR%\logs"
set "LOG_FILE=%LOG_DIR%\debug-mcp-server.log"

if not exist "%DIST_PATH%" (
    echo ERROR: Build output not found at "%DIST_PATH%"
    echo Please run: pnpm build
    pause
    exit /b 1
)

if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%" >nul 2>&1
)

echo [OK] Build artifact located at: "%DIST_PATH%"
echo.

pushd "%ROOT_DIR%" >nul
node "%DIST_PATH%" sse --port 3001 --log-level debug --log-file "%LOG_FILE%"
popd >nul

endlocal
