# Line 1: Comment line
x = 10  # Line 2: Valid executable
        # Line 3: Blank line with whitespace
"""     # Line 4: Start of docstring
This is a multi-line docstring
that spans several lines
"""     # Line 7: End of docstring
def foo():  # Line 8: Function definition
    pass    # Line 9: Pass statement
# Line 10: Another comment
y = 20  # Line 11: Valid executable


# Line 14: Comment after blank lines
if __name__ == "__main__":  # Line 15: Conditional
    print(f"x = {x}")  # Line 16: Print statement
    print(f"y = {y}")  # Line 17: Another print
    foo()  # Line 18: Function call
# Line 19: Final comment
