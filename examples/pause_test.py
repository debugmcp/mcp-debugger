#!/usr/bin/env python3
"""
Test script that pauses for user input to allow debugging testing.
"""

def main():
    """Main function with variables for testing."""
    x = 10
    y = 20
    result = x + y
    message = "Testing debugger"
    
    print("Before input - set breakpoint here")
    # This line will pause execution
    user_input = input("Press Enter to continue: ")
    print(f"After input: {user_input}")
    
    final_result = result * 2
    print(f"Final result: {final_result}")

if __name__ == "__main__":
    main()
