# examples/java/TestJavaDebug.java
@source-hash: 1d4829921cb81050
@generated: 2026-02-09T18:14:55Z

## TestJavaDebug.java

**Purpose**: Comprehensive test script demonstrating Java debugging scenarios with multiple computational operations and output patterns.

**Architecture**: Single public class containing static utility methods and a main driver method for testing various algorithmic operations.

### Key Components

**TestJavaDebug class (L4-75)**
- Main container class with static methods designed for debugging practice
- No instance variables or constructors - purely functional approach

**Core Methods**:

**factorial(int n) (L9-14)**
- Recursive factorial implementation with base case at n <= 1
- Standard tail-recursive pattern returning n * factorial(n-1)
- No input validation or overflow protection

**sumArray(int[] numbers) (L19-25)**
- Iterates through integer array using enhanced for-loop
- Accumulates sum in local `total` variable
- Returns final sum value

**processData(int[] data) (L30-37)**
- Creates new array with same length as input
- Applies transformation: each element multiplied by 2
- Returns new processed array without modifying original

**main(String[] args) (L42-74)**
- Driver method demonstrating usage of all utility methods
- Tests basic arithmetic (L44-46), factorial calculation (L49-50)
- Tests array summation (L53-55) and data processing (L58-67)
- Includes formatted output with manual array printing loop (L60-67)
- Computes final result combining multiple operations (L70-71)

### Dependencies
- Uses standard Java I/O via System.out.println for output
- No external libraries or imports required

### Notable Patterns
- All methods are static - no object instantiation required
- Consistent error-free execution path with predictable outputs
- Manual array printing implementation rather than using Arrays.toString()
- Linear execution flow in main method with clear test sections

### Execution Flow
1. Basic variable initialization and arithmetic
2. Factorial computation test (5! = 120)
3. Array summation test (sum of [1,2,3,4,5] = 15)
4. Data processing test (doubles each element in [10,20,30])
5. Final computation combining results
6. Completion message with final result