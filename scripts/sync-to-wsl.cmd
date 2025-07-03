@echo off
REM Windows helper to run the WSL sync script
REM This makes it easy to sync from Windows command prompt or PowerShell

echo MCP Debugger - Sync to WSL2
echo ===========================
echo.

REM Check if WSL is installed
wsl --status >nul 2>&1
if errorlevel 1 (
    echo ERROR: WSL is not installed or not available
    echo Please install WSL2 first: https://docs.microsoft.com/en-us/windows/wsl/install
    exit /b 1
)

REM Run the sync script in WSL
echo Running sync script in WSL2...
echo.

REM The script needs to be run from within the WSL environment
REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
REM Get the project root (parent of scripts directory)
for %%i in ("%SCRIPT_DIR%..") do set PROJECT_DIR=%%~fi

REM Convert paths to WSL format
for /f "tokens=*" %%i in ('wsl wslpath -a "%SCRIPT_DIR%sync-to-wsl.sh"') do set WSL_SCRIPT_PATH=%%i
for /f "tokens=*" %%i in ('wsl wslpath -a "%PROJECT_DIR%"') do set WSL_PROJECT_PATH=%%i

REM Copy and execute the script with the project path
wsl -e bash -c "cp '%WSL_SCRIPT_PATH%' /tmp/sync-to-wsl.sh && chmod +x /tmp/sync-to-wsl.sh && /tmp/sync-to-wsl.sh '%WSL_PROJECT_PATH%' %*"

echo.
echo Done!
pause
