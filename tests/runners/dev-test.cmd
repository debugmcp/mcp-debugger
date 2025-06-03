@echo off
echo ===== Debug MCP Server Development Test =====
echo This script restarts the server and runs the relevant tests.
echo.

rem Build the project to ensure latest changes are included
echo Building project...
call npm run build
if %ERRORLEVEL% neq 0 (
  echo Build failed!
  exit /b %ERRORLEVEL%
)
echo Build successful!
echo.

rem Kill any existing instances of the server
echo Stopping any existing MCP server instances...
taskkill /F /FI "WINDOWTITLE eq debug-mcp-server" /T >nul 2>&1
timeout /t 2 /nobreak >nul

rem Start server in a new terminal window with enhanced logging
echo Starting server in a separate window with debug logging...
start "debug-mcp-server" cmd /c "node dist/index.js --log-level debug --log-file logs/debug-mcp-server.log"

rem Wait for server to start
echo Waiting for server to start...
timeout /t 5 /nobreak > nul

echo.
echo =================================
echo Select a test to run:
echo =================================
echo 1. Run unit tests
echo 2. Run integration tests
echo 3. Run e2e tests
echo 4. Run all tests
echo.

set /p TEST_OPTION=Enter option (1-4): 

if "%TEST_OPTION%"=="1" (
  echo Running unit tests...
  call npm run test:unit
) else if "%TEST_OPTION%"=="2" (
  echo Running integration tests...
  call npm run test:integration
) else if "%TEST_OPTION%"=="3" (
  echo Running e2e tests...
  call npm run test:e2e
) else if "%TEST_OPTION%"=="4" (
  echo Running all tests...
  call npm test
) else (
  echo Invalid option!
)

rem Prompt to keep the server running or shut it down
echo.
set /p KEEP_RUNNING=Keep the server running? (y/n): 
if /i "%KEEP_RUNNING%" neq "y" (
  echo Shutting down server...
  taskkill /F /FI "WINDOWTITLE eq debug-mcp-server" /T >nul 2>&1
  echo Server shut down.
) else (
  echo Server is still running in the other window.
  echo Check logs/debug-mcp-server.log for detailed error information.
)

echo Done.
