@echo off
echo ===== Debug MCP Server Test Cleanup =====
echo This script will remove obsolete test files that are no longer needed
echo or might cause confusion about the correct architecture.
echo.

set CONFIRM=n
set /p CONFIRM="Are you sure you want to remove obsolete test files? (y/n): "

if /i NOT "%CONFIRM%"=="y" (
  echo Cleanup cancelled.
  exit /b 0
)

echo.
echo Removing obsolete test files...

rem Root directory obsolete files
IF EXIST "%~dp0\..\..\debugpy_client_test.py" (
  echo - Removing debugpy_client_test.py
  del "%~dp0\..\..\debugpy_client_test.py"
)

IF EXIST "%~dp0\..\..\debugpy_server_test.py" (
  echo - Removing debugpy_server_test.py (consolidated into fixtures)
  del "%~dp0\..\..\debugpy_server_test.py"
)

IF EXIST "%~dp0\..\..\dap_client_test.py" (
  echo - Removing dap_client_test.py
  del "%~dp0\..\..\dap_client_test.py"
)

IF EXIST "%~dp0\..\..\test_python_debugger.js" (
  echo - Removing test_python_debugger.js
  del "%~dp0\..\..\test_python_debugger.js"
)

IF EXIST "%~dp0\..\..\debug_init_test.js" (
  echo - Removing debug_init_test.js
  del "%~dp0\..\..\debug_init_test.js"
)

IF EXIST "%~dp0\..\..\test_mcp_debug_integration.js" (
  echo - Removing test_mcp_debug_integration.js
  del "%~dp0\..\..\test_mcp_debug_integration.js"
)

IF EXIST "%~dp0\..\..\test_mcp_debugpy_client.js" (
  echo - Removing test_mcp_debugpy_client.js
  del "%~dp0\..\..\test_mcp_debugpy_client.js"
)

IF EXIST "%~dp0\..\..\test_mcp_debug_tools.js" (
  echo - Removing test_mcp_debug_tools.js (consolidated into proper test structure)
  del "%~dp0\..\..\test_mcp_debug_tools.js"
)

rem Command script files
IF EXIST "%~dp0\..\..\combined_debugpy_test.cmd" (
  echo - Removing combined_debugpy_test.cmd
  del "%~dp0\..\..\combined_debugpy_test.cmd"
)

IF EXIST "%~dp0\..\..\test_dap_connection.cmd" (
  echo - Removing test_dap_connection.cmd
  del "%~dp0\..\..\test_dap_connection.cmd"
)

IF EXIST "%~dp0\..\..\test-debugging.cmd" (
  echo - Removing test-debugging.cmd
  del "%~dp0\..\..\test-debugging.cmd"
)

IF EXIST "%~dp0\..\..\restart-and-test.cmd" (
  echo - Removing restart-and-test.cmd
  del "%~dp0\..\..\restart-and-test.cmd"
)

IF EXIST "%~dp0\..\..\run-debug-test.cmd" (
  echo - Removing run-debug-test.cmd (replaced by tests/runners/run-tests.cmd)
  del "%~dp0\..\..\run-debug-test.cmd"
)

echo.
echo Cleanup complete! All obsolete test files have been removed.
echo The project now uses a clean, structured testing approach with:
echo  - Unit tests in tests/unit/
echo  - Integration tests in tests/integration/
echo  - E2E tests in tests/e2e/
echo  - Test fixtures in tests/fixtures/
echo  - Test utilities in tests/utils/
echo  - Test runners in tests/runners/
echo.
echo Use 'tests/runners/run-tests.cmd' to run the tests.
