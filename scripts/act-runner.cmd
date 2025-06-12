@echo off
REM Act runner script - checks Docker prerequisites before running Act

REM Check if docker is running
docker info > nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop.
    exit /b 1
)

REM Check if logged in to Docker Hub by trying to pull a small test image
docker pull hello-world > nul 2>&1
if errorlevel 1 (
    echo Error: Unable to pull Docker images. Please log in to Docker Hub first:
    echo.
    echo   docker login
    echo.
    echo After logging in, try running this command again.
    exit /b 1
)

REM Clean up the test image
docker rmi hello-world > nul 2>&1

echo Docker is properly configured. Running Act...
echo.

REM Run act with all passed arguments
act %*
