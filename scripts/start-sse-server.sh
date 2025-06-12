#!/bin/bash

echo "========================================"
echo "Debug MCP Server - SSE Launcher"
echo "========================================"
echo

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not found in PATH!"
    exit 1
fi
echo "[OK] Node.js is available"

# Check Python
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "ERROR: Python is not found in PATH!"
    exit 1
fi

# Determine Python command
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
fi
echo "[OK] Python is available ($PYTHON_CMD)"

# Check debugpy
if ! $PYTHON_CMD -c "import debugpy" 2>/dev/null; then
    echo "ERROR: debugpy module is not installed!"
    echo "Please run: $PYTHON_CMD -m pip install debugpy"
    exit 1
fi
echo "[OK] debugpy is available"

echo
echo "Environment checks passed!"
echo
echo "Starting Debug MCP Server in SSE mode..."
echo "Server will be available at: http://localhost:3001/sse"
echo
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo

# Start the server
node dist/index.js sse --port 3001 --log-level debug --log-file logs/debug-mcp-server.log
