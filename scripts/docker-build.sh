#!/bin/bash
# Build the Debug MCP Server Docker image

echo "Building Debug MCP Server Docker image..."
docker build -t debug-mcp-server .

echo
echo "Image built successfully!"
echo "To run the server use:"
echo "  docker run -i --rm debug-mcp-server"
echo
