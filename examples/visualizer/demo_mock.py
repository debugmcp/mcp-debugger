#!/usr/bin/env python3
"""
Test the visualizer with mock debugging data.

This demonstrates the TUI visualizer capabilities with a simulated
debugging session, showcasing:
- Dynamic code window following execution
- Multiple breakpoints
- Variable inspection
- Stepping through code
"""

import time
import os
import threading
import sys
from pathlib import Path

# Add parent directory to path to import the visualizer
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from examples.visualizer.debug_visualizer import DebugVisualizer


def run_mock_debugging_session(viz: DebugVisualizer):
    """
    Simulate a debugging session with the swap_vars.py example.
    
    Args:
        viz: The DebugVisualizer instance to update
    """
    # Calculate absolute path to swap_vars.py
    current_dir = Path(__file__).parent
    project_root = current_dir.parent.parent
    swap_vars_path = str(project_root / "examples" / "python_simple_swap" / "swap_vars.py")
    
    # Ensure the file exists
    if not os.path.exists(swap_vars_path):
        print(f"Error: Could not find {swap_vars_path}")
        print("Please ensure swap_vars.py exists in examples/python_simple_swap/")
        return
    
    # Define the debugging steps
    steps = [
        # Step 1: Create session
        {
            "action": lambda: viz.create_session("abc-123-def-456", "Debug swap_vars"),
            "delay": 2.0,
            "description": "Creating debug session"
        },
        
        # Step 2: Set first breakpoint
        {
            "action": lambda: viz.set_breakpoint(swap_vars_path, 4),
            "delay": 2.0,
            "description": "Setting breakpoint at line 4 (start of function)"
        },
        
        # Step 3: Set second breakpoint
        {
            "action": lambda: viz.set_breakpoint(swap_vars_path, 10),
            "delay": 2.0,
            "description": "Setting breakpoint at line 10 (buggy swap)"
        },
        
        # Step 4: Set third breakpoint
        {
            "action": lambda: viz.set_breakpoint(swap_vars_path, 20),
            "delay": 2.0,
            "description": "Setting breakpoint at line 20 (in main)"
        },
        
        # Step 5: Start debugging
        {
            "action": lambda: viz.start_debugging(swap_vars_path),
            "delay": 2.0,
            "description": "Starting debug session"
        },
        
        # Step 6: Hit first breakpoint
        {
            "action": lambda: viz.pause_at_breakpoint(swap_vars_path, 4),
            "delay": 2.5,
            "description": "Hit breakpoint at function entry"
        },
        
        # Step 7: Show initial variables
        {
            "action": lambda: viz.update_variables({'a': '10', 'b': '20'}),
            "delay": 3.0,
            "description": "Showing initial variable values"
        },
        
        # Step 8: Step to print statement
        {
            "action": lambda: viz.step_to_line(swap_vars_path, 5, "over"),
            "delay": 2.5,
            "description": "Step to print statement"
        },
        
        # Step 9: Step to buggy swap (line 10)
        {
            "action": lambda: viz.step_to_line(swap_vars_path, 10, "over"),
            "delay": 2.5,
            "description": "Step to buggy swap logic"
        },
        
        # Step 10: Execute first buggy assignment
        {
            "action": lambda: viz.step_to_line(swap_vars_path, 11, "over"),
            "delay": 2.5,
            "description": "Execute a = b (bug!)"
        },
        
        # Step 11: Update variables to show bug
        {
            "action": lambda: viz.update_variables({'a': '20', 'b': '20'}),
            "delay": 3.0,
            "description": "Variables after buggy assignment"
        },
        
        # Step 12: Step to return
        {
            "action": lambda: viz.step_to_line(swap_vars_path, 13, "over"),
            "delay": 2.5,
            "description": "Step to return statement"
        },
        
        # Step 13: Continue to main
        {
            "action": lambda: viz.continue_execution(),
            "delay": 2.0,
            "description": "Continue execution"
        },
        
        # Step 14: Hit breakpoint in main
        {
            "action": lambda: viz.pause_at_breakpoint(swap_vars_path, 20),
            "delay": 2.5,
            "description": "Hit breakpoint in main()"
        },
        
        # Step 15: Show main variables
        {
            "action": lambda: viz.update_variables({
                'x': '10', 
                'y': '20',
                'swapped_x': '20',
                'swapped_y': '20'
            }),
            "delay": 3.0,
            "description": "Variables in main after swap"
        },
        
        # Step 16: Step to verification
        {
            "action": lambda: viz.step_to_line(swap_vars_path, 23, "over"),
            "delay": 2.5,
            "description": "Step to verification check"
        },
        
        # Step 17: Step to failure message
        {
            "action": lambda: viz.step_to_line(swap_vars_path, 26, "over"),
            "delay": 2.5,
            "description": "Swap failed - showing error message"
        },
        
        # Step 18: Continue to end
        {
            "action": lambda: viz.continue_execution(),
            "delay": 3.0,
            "description": "Continue to program end"
        },
        
        # Step 19: Close session
        {
            "action": lambda: viz.close_session(),
            "delay": 3.0,
            "description": "Closing debug session"
        }
    ]
    
    # Execute the steps silently to avoid interfering with the TUI
    for i, step in enumerate(steps, 1):
        try:
            step['action']()
            time.sleep(step['delay'])
        except Exception as e:
            # Silently handle errors to avoid display interference
            break
    
    # Keep running for a bit more
    time.sleep(5)
    
    # Stop the visualizer
    viz.stop()


def main():
    """Main entry point for the mock demo."""
    print("=== MCP Debug Visualizer Mock Demo ===")
    print("\nThis demo simulates a debugging session to showcase the visualizer.")
    print("The visualizer will show:")
    print("- Dynamic code window that follows execution")
    print("- Breakpoint markers (●) and current line indicators (→)")
    print("- Variable inspection")
    print("- Tool activity history")
    print("\nPress Ctrl+C at any time to exit.")
    print("\nStarting in 3 seconds...")
    time.sleep(3)
    
    # Create visualizer
    viz = DebugVisualizer()
    
    # Start the mock session in a separate thread
    session_thread = threading.Thread(
        target=run_mock_debugging_session,
        args=(viz,),
        daemon=True
    )
    session_thread.start()
    
    try:
        # Run the visualizer (this blocks)
        viz.run()
    except KeyboardInterrupt:
        print("\n\nDemo interrupted by user.")
    except Exception as e:
        print(f"\n\nError running demo: {e}")
    finally:
        print("\nDemo complete!")


if __name__ == "__main__":
    main()
