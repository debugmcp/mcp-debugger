#!/usr/bin/env python3
"""Test the panels directly to debug the code view issue."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from rich.console import Console
from examples.visualizer.panels import CodeViewPanel
from examples.visualizer.state import DebugState

def test_code_panel():
    """Test the code panel with a known file."""
    console = Console()
    
    # Create a code panel
    code_panel = CodeViewPanel()
    
    # Get the swap_vars.py path
    current_dir = Path(__file__).parent
    project_root = current_dir.parent.parent
    swap_vars_path = str(project_root / "examples" / "python_simple_swap" / "swap_vars.py")
    
    print(f"Testing with file: {swap_vars_path}")
    print(f"File exists: {Path(swap_vars_path).exists()}")
    
    # Test 1: Simple render with just file path
    print("\n=== Test 1: File only ===")
    panel = code_panel.render(
        file_path=swap_vars_path,
        current_line=None,
        breakpoints={},
        variables={}
    )
    console.print(panel)
    
    # Test 2: With current line
    print("\n=== Test 2: With current line ===")
    panel = code_panel.render(
        file_path=swap_vars_path,
        current_line=4,
        breakpoints={},
        variables={}
    )
    console.print(panel)
    
    # Test 3: With breakpoints
    print("\n=== Test 3: With breakpoints ===")
    panel = code_panel.render(
        file_path=swap_vars_path,
        current_line=4,
        breakpoints={swap_vars_path: {4, 10, 20}},
        variables={}
    )
    console.print(panel)
    
    # Test 4: With variables
    print("\n=== Test 4: With variables ===")
    panel = code_panel.render(
        file_path=swap_vars_path,
        current_line=10,
        breakpoints={swap_vars_path: {4, 10, 20}},
        variables={'a': '10', 'b': '20'}
    )
    console.print(panel)

if __name__ == "__main__":
    test_code_panel()
