#!/usr/bin/env python3
"""
Converts asciinema recording to optimized GIF
"""
import subprocess
import sys
from pathlib import Path

def check_tool(tool_name: str, install_hint: str) -> bool:
    """Check if a tool is installed"""
    result = subprocess.run(['which', tool_name], capture_output=True)
    if result.returncode != 0:
        print(f"Error: {tool_name} not installed")
        print(f"Install with: {install_hint}")
        return False
    return True

def convert_to_gif(cast_file: str = "mcp-debugger-demo-swap-bug.cast"):
    """Convert asciinema cast to GIF"""
    
    # Check dependencies
    if not check_tool('agg', 'cargo install --git https://github.com/asciinema/agg'):
        return
        
    project_root = Path(__file__).parent.parent.parent
    output_gif = project_root / "assets" / "demo.gif"
    
    # Ensure assets directory exists
    output_gif.parent.mkdir(exist_ok=True)
    
    print(f"Converting {cast_file} to GIF...")
    
    # Convert using agg
    subprocess.run([
        'agg',
        cast_file,
        str(output_gif),
        '--theme', 'monokai',
        '--font-size', '14',
        '--speed', '1.2',  # Slightly faster playback
        '--line-height', '1.4'
    ])
    
    # Check file size
    if output_gif.exists():
        size_mb = output_gif.stat().st_size / (1024 * 1024)
        print(f"\n✓ GIF created: {output_gif}")
        print(f"  Size: {size_mb:.2f} MB")
        
        if size_mb > 10:
            print("\n⚠️  GIF exceeds 10MB limit")
            print("  Try: python optimize_gif.py")
    
    # Optional: Remove cast file
    response = input("\nRemove cast file? (y/n): ")
    if response.lower() == 'y':
        Path(cast_file).unlink()

if __name__ == "__main__":
    convert_to_gif()
