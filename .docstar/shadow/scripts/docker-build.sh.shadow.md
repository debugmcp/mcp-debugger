# scripts/docker-build.sh
@source-hash: 0984064fe31719d3
@generated: 2026-02-10T00:41:55Z

## Purpose
Shell script for building a Docker image for the Debug MCP Server. Provides a simple wrapper around `docker build` with user-friendly output and usage instructions.

## Key Components
- **Docker Build Command (L5)**: Executes `docker build -t debug-mcp-server .` to create the image with tag "debug-mcp-server" from the current directory's Dockerfile
- **User Feedback (L4, L8-10)**: Provides status messages and usage instructions for running the built container

## Behavior
1. Displays build start message
2. Builds Docker image using current directory as build context
3. Tags the resulting image as "debug-mcp-server"
4. Provides success confirmation and run instructions

## Dependencies
- Requires Docker to be installed and accessible
- Expects a Dockerfile in the current directory (implied by `.` context)
- Assumes script is run from the project root directory

## Usage Pattern
Typical development workflow script - meant to be executed from command line to rebuild the Docker image during development cycles. The provided run command uses `-i --rm` flags for interactive mode with automatic cleanup.