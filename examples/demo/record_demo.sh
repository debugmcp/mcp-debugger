#!/bin/bash
# Script to record the mcp-debugger demo as a GIF using asciinema and svg-term-cli

echo "Recording MCP Debugger Demo..."
echo "This will create a GIF for the README"
echo ""

# Check if asciinema is installed
if ! command -v asciinema &> /dev/null; then
    echo "asciinema is not installed. Please install it first:"
    echo "  brew install asciinema  # macOS"
    echo "  sudo apt-get install asciinema  # Ubuntu/Debian"
    exit 1
fi

# Check if svg-term is installed
if ! command -v svg-term &> /dev/null; then
    echo "svg-term-cli is not installed. Installing..."
    npm install -g svg-term-cli
fi

# Record the demo
echo "Starting recording in 3 seconds..."
sleep 3

asciinema rec --title "MCP Debugger Demo" \
    --idle-time-limit 2 \
    --cols 80 \
    --rows 30 \
    demo.cast

# Convert to SVG
echo "Converting to SVG..."
svg-term --in demo.cast --out demo.svg --window --no-cursor --width 80 --height 30

# Convert SVG to GIF (requires additional tools)
echo ""
echo "Demo recorded successfully!"
echo "Files created:"
echo "  - demo.cast (asciinema recording)"
echo "  - demo.svg (SVG animation)"
echo ""
echo "To convert to GIF, you can use:"
echo "  1. Online converter: https://cloudconvert.com/svg-to-gif"
echo "  2. Or install ImageMagick and run:"
echo "     convert demo.svg demo.gif"
echo ""
echo "Then move the GIF to the repository root and update README.md"
