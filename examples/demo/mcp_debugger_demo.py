#!/usr/bin/env python3
"""
MCP Debugger Demo Script
========================

This script demonstrates how an LLM would use mcp-debugger to find and fix
a bug in the swap_vars.py example.

This is designed to be recorded as a GIF/video for the README.
"""

import time
import sys
from pathlib import Path

# ANSI color codes for pretty output
class Colors:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

def print_llm(message: str):
    """Print a message as if from the LLM"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}🤖 LLM:{Colors.END} {message}")
    time.sleep(0.5)

def print_debugger(message: str):
    """Print a message as if from the debugger"""
    print(f"{Colors.GREEN}🐛 Debugger:{Colors.END} {message}")
    time.sleep(0.3)

def print_code(code: str, highlight_line: int = None):
    """Print code with optional line highlighting"""
    lines = code.strip().split('\n')
    print(f"\n{Colors.CYAN}📄 swap_vars.py:{Colors.END}")
    for i, line in enumerate(lines, 1):
        if i == highlight_line:
            print(f"{Colors.YELLOW}{Colors.BOLD}{i:2d} →{Colors.END} {line}")
        else:
            print(f"{Colors.CYAN}{i:2d} |{Colors.END} {line}")
    print()

def print_variables(vars_dict: dict):
    """Print variable values"""
    print(f"{Colors.MAGENTA}📊 Variables:{Colors.END}")
    for name, value in vars_dict.items():
        print(f"   {name} = {value}")
    print()

def demo_title():
    """Print demo title"""
    print("\n" + "="*60)
    print(f"{Colors.BOLD}MCP Debugger Demo - Finding and Fixing a Python Bug{Colors.END}")
    print("="*60)
    time.sleep(1)

def main():
    # The buggy code
    buggy_code = """def swap_variables(a, b):
    print(f"Initial values: a = {a}, b = {b}")
    # Intentionally buggy swap logic
    a = b  # Bug: 'a' loses its original value here
    b = a  # Bug: 'b' gets the new value of 'a'
    print(f"Swapped values: a = {a}, b = {b}")
    return a, b

x = 10
y = 20
swapped_x, swapped_y = swap_variables(x, y)"""

    demo_title()

    # Step 1: LLM identifies the task
    print_llm("I need to debug swap_vars.py to find why the swap function doesn't work correctly.")
    time.sleep(1)

    # Step 2: Create debug session
    print_llm("Let me create a debug session for Python...")
    print_debugger("✓ Debug session created: session-123")
    time.sleep(1)

    # Step 3: Show the code
    print_llm("First, let me examine the code:")
    print_code(buggy_code)
    time.sleep(2)

    # Step 4: Set breakpoint
    print_llm("I'll set a breakpoint at line 4 where the swap happens:")
    print_debugger("✓ Breakpoint set at line 4")
    print_code(buggy_code, highlight_line=4)
    time.sleep(1)

    # Step 5: Run the script
    print_llm("Now let's run the script and see what happens:")
    print_debugger("⏸️ Paused at breakpoint (line 4)")
    time.sleep(1)

    # Step 6: Inspect variables before the bug
    print_llm("Let me check the variable values at this point:")
    print_variables({"a": 10, "b": 20})
    time.sleep(1)

    # Step 7: Step over
    print_llm("I'll step over to the next line:")
    print_debugger("⏩ Stepped to line 5")
    print_code(buggy_code, highlight_line=5)
    
    # Step 8: Inspect variables after first assignment
    print_llm("Now let's check the variables again:")
    print_variables({"a": 20, "b": 20})
    
    # Step 9: Identify the bug
    print_llm(f"{Colors.RED}{Colors.BOLD}Found the bug!{Colors.END} The value of 'a' was overwritten before being saved.")
    print_llm("When we do 'a = b', we lose the original value of 'a'.")
    print_llm("Then 'b = a' just copies the new value of 'a' (which is 20) back to 'b'.")
    time.sleep(2)

    # Step 10: Suggest fix
    print(f"\n{Colors.GREEN}{Colors.BOLD}💡 Solution:{Colors.END}")
    fixed_code = """def swap_variables(a, b):
    print(f"Initial values: a = {a}, b = {b}")
    # Correct swap using tuple unpacking
    a, b = b, a
    print(f"Swapped values: a = {a}, b = {b}")
    return a, b"""
    
    print_code(fixed_code)
    
    print_llm("The fix is to use Python's tuple unpacking: 'a, b = b, a'")
    print_llm("This swaps the values in a single atomic operation without losing data!")
    
    # Step 11: Verify fix
    print(f"\n{Colors.GREEN}{Colors.BOLD}✅ Verification:{Colors.END}")
    print("Initial: x=10, y=20")
    print("After swap: x=20, y=10")
    print(f"{Colors.GREEN}Swap successful!{Colors.END}")
    
    print("\n" + "="*60)
    print(f"{Colors.BOLD}Demo Complete - Bug Fixed!{Colors.END}")
    print("="*60 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nDemo interrupted.")
        sys.exit(0)
