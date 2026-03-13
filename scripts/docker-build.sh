#!/bin/bash
# Build the Debug MCP Server Docker image

echo "Building Debug MCP Server Docker image..."
docker build -t debug-mcp-server .

if [ $? -ne 0 ]; then
    echo
    echo "Docker build failed!"
    exit 1
fi

echo
echo "Image built successfully!"
echo "To run the server use:"
echo "  docker run -i --rm debug-mcp-server"
echo
