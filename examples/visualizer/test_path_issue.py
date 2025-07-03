#!/usr/bin/env python3
"""Test to debug path normalization issue."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from examples.visualizer.debug_visualizer import DebugVisualizer

def test_path_normalization():
    """Test path normalization in the visualizer."""
    
    # Create visualizer
    viz = DebugVisualizer()
    
    # Get the swap_vars.py path (same as demo)
    current_dir = Path(__file__).parent
    project_root = current_dir.parent.parent
    swap_vars_path = str(project_root / "examples" / "python_simple_swap" / "swap_vars.py")
    
    print(f"Original path: {swap_vars_path}")
    print(f"Resolved path: {str(Path(swap_vars_path).resolve())}")
    
    # Set a breakpoint (this should update location)
    viz.set_breakpoint(swap_vars_path, 4)
    
    # Check what's in state
    print(f"\nState after set_breakpoint:")
    print(f"Current location: {viz.state.current_location}")
    if viz.state.current_location:
        print(f"  File path: {viz.state.current_location.file_path}")
        print(f"  Line: {viz.state.current_location.line}")
    
    print(f"\nBreakpoints in state:")
    for file_path, lines in viz.state.breakpoints.items():
        print(f"  {file_path}: {lines}")
    
    # Check if paths match
    if viz.state.current_location:
        normalized_current = str(Path(viz.state.current_location.file_path).resolve())
        print(f"\nNormalized current location: {normalized_current}")
        
        for bp_path in viz.state.breakpoints.keys():
            normalized_bp = str(Path(bp_path).resolve())
            print(f"Normalized breakpoint path: {normalized_bp}")
            print(f"Paths match: {normalized_current == normalized_bp}")

if __name__ == "__main__":
    test_path_normalization()
