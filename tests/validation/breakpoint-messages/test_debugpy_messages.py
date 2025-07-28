#!/usr/bin/env python3
"""Test file to explore debugpy's breakpoint validation messages"""

# Line 4: Comment line - test what message debugpy provides
x = 10  # Line 5: Valid executable line

# Line 7: Another comment
        # Line 8: Indented comment

# Line 10: Blank line below

def test_function():  # Line 12: Function definition
    """Line 13: Docstring start
    This is a docstring
    Line 15: Docstring content
    """  # Line 16: Docstring end
    y = 20  # Line 17: Valid executable inside function
    return y  # Line 18: Return statement


# Line 21: Comment after function
if __name__ == "__main__":  # Line 22: Main check
    print(f"x = {x}")  # Line 23: Print statement
    result = test_function()  # Line 24: Function call
    print(f"result = {result}")  # Line 25: Another print

# Line 27: Final comment
# Test beyond EOF by setting breakpoint on line 100
