@echo off
echo ===== Debug MCP Server Test Runner =====
echo.

SET TEST_TYPE=%1
SET TEST_FILE=%2

IF "%TEST_TYPE%"=="" (
  GOTO usage
)

rem Build the project first to ensure latest changes are included
echo Building project...
call npm run build
IF %ERRORLEVEL% NEQ 0 (
  echo Build failed!
  exit /b %ERRORLEVEL%
)
echo Build successful!
echo.

rem Run appropriate test based on type
IF /I "%TEST_TYPE%"=="unit" (
  GOTO run_unit
) ELSE IF /I "%TEST_TYPE%"=="integration" (
  GOTO run_integration
) ELSE IF /I "%TEST_TYPE%"=="e2e" (
  GOTO run_e2e
) ELSE IF /I "%TEST_TYPE%"=="all" (
  GOTO run_all
) ELSE (
  echo Unknown test type: %TEST_TYPE%
  GOTO usage
)

:run_unit
echo Running unit tests...
IF "%TEST_FILE%"=="" (
  call node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit --testPathIgnorePatterns=node_modules
) ELSE (
  call node --experimental-vm-modules node_modules/jest/bin/jest.js %TEST_FILE% --testPathIgnorePatterns=node_modules
)
exit /b %ERRORLEVEL%

:run_integration
echo Running integration tests...
IF "%TEST_FILE%"=="" (
  call node --experimental-vm-modules node_modules/jest/bin/jest.js tests/integration --testPathIgnorePatterns=node_modules
) ELSE (
  call node --experimental-vm-modules node_modules/jest/bin/jest.js %TEST_FILE% --testPathIgnorePatterns=node_modules
)
exit /b %ERRORLEVEL%

:run_e2e
echo Running end-to-end tests...
echo IMPORTANT: These tests will start actual debugpy and MCP servers.
echo.
IF "%TEST_FILE%"=="" (
  call node --experimental-vm-modules node_modules/jest/bin/jest.js tests/e2e --testPathIgnorePatterns=node_modules --testTimeout=30000
) ELSE (
  call node --experimental-vm-modules node_modules/jest/bin/jest.js %TEST_FILE% --testPathIgnorePatterns=node_modules --testTimeout=30000
)
exit /b %ERRORLEVEL%

:run_all
echo Running all tests...
call node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathIgnorePatterns=node_modules
exit /b %ERRORLEVEL%

:usage
echo Usage: run-tests [unit|integration|e2e|all] [optional test file]
echo.
echo Examples:
echo   run-tests unit                   - Run all unit tests
echo   run-tests integration            - Run all integration tests
echo   run-tests e2e                    - Run all end-to-end tests
echo   run-tests all                    - Run all tests
echo   run-tests unit tests/unit/session/session-manager.test.ts - Run specific test file
exit /b 1
