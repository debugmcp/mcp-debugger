# swap_vars.py
# A simple script that swaps two variables, with an intentional bug for debugging.

def swap_variables(a, b):
    print(f"Initial values: a = {a}, b = {b}")
    # Intentionally buggy swap logic for demonstration
    # Correct logic would use a temporary variable: temp = a; a = b; b = temp
    # Or Python's tuple assignment: a, b = b, a
    
    a = b  # Bug: 'a' loses its original value here
    b = a  # Bug: 'b' gets the new value of 'a' (which is original 'b')
    
    print(f"Swapped values: a = {a}, b = {b}")
    return a, b

def main():
    x = 10
    y = 20
    
    print("Starting variable swap demo...")
    swapped_x, swapped_y = swap_variables(x, y)
    
    # Verification
    if swapped_x == 20 and swapped_y == 10:
        print("Swap successful!")
    else:
        print(f"Swap NOT successful. Expected x=20, y=10 but got x={swapped_x}, y={swapped_y}")

if __name__ == "__main__":
    main()
