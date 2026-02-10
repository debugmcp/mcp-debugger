# scripts/docker-build.sh
@source-hash: 0984064fe31719d3
@generated: 2026-02-09T18:15:09Z

## Purpose
Docker build automation script for the Debug MCP Server. Provides a streamlined way to build the Docker image with consistent naming and includes usage instructions for developers.

## Key Operations
- **Docker Image Build (L5)**: Executes `docker build` command to create image tagged as `debug-mcp-server` from current directory context
- **User Guidance (L9-10)**: Provides runtime command example using interactive mode with automatic cleanup (`-i --rm` flags)

## Script Flow
1. **Build Notification (L4)**: Announces build process start
2. **Image Creation (L5)**: Builds Docker image using current directory as build context
3. **Success Feedback (L8-11)**: Confirms successful build and displays usage instructions

## Dependencies
- Docker daemon must be available and running
- Dockerfile must exist in current directory (implied by build context `.`)
- Current working directory should be project root

## Usage Pattern
Simple wrapper script that standardizes the Docker build process and eliminates need to remember image tag naming conventions. Designed for developer convenience with clear feedback and next-step guidance.