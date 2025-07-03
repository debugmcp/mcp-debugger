#!/usr/bin/env python3
"""
Records the debugging session using asciinema
"""
import subprocess
import sys
from pathlib import Path

def main():
    """Set up and start recording"""
    
    # Check if asciinema is installed
    if subprocess.run(['which', 'asciinema'], capture_output=True).returncode != 0:
        print("Error: asciinema not installed")
        print("Install with: brew install asciinema (macOS)")
        print("           : sudo apt-get install asciinema (Linux)")
        print("           : pip install asciinema (Python)")
        print("\nFallback options:")
        print("- Use 'script' command (built into most Unix systems)")
        print("- Use OBS Studio for cross-platform screen recording")
        sys.exit(1)
    
    print("MCP Debugger Demo Recording")
    print("=" * 60)
    print("\nInstructions:")
    print("1. Make sure demo_runner.py is running in another terminal")
    print("2. Position your terminal window (recommended: 120x30)")
    print("3. Press Enter to start recording")
    print("4. Use your MCP client to execute the debugging demo")
    print("5. Press Ctrl+D to stop recording")
    print("=" * 60)
    
    input("\nPress Enter when ready...")
    
    # Start recording with descriptive filename
    cast_file = "mcp-debugger-demo-swap-bug.cast"
    
    subprocess.run([
        'asciinema', 'rec',
        '--title', 'MCP Debugger - AI-Powered Python Debugging (Variable Swap Bug)',
        '--idle-time-limit', '3',
        '--cols', '120',
        '--rows', '30',
        cast_file
    ])
    
    print(f"\n✓ Recording saved to: {cast_file}")
    print("\nNext: Convert to GIF using convert_to_gif.py")

if __name__ == "__main__":
    main()
