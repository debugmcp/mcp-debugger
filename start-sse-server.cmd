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
node dist/index.js sse --port 3001 --log-level debug --log-file logs/debug-mcp-server.log

endlocal