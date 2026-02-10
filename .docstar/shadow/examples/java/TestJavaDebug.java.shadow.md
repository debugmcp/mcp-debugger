# examples/java/TestJavaDebug.java
@source-hash: 1d4829921cb81050
@generated: 2026-02-10T00:41:39Z

## TestJavaDebug.java

**Purpose**: Educational test class for Java debugging practice, demonstrating common programming patterns and computational operations.

**Architecture**: Single utility class with static methods, designed for standalone execution without dependencies.

### Key Components

**TestJavaDebug class (L4-75)**
- Entry point class containing mathematical and array processing utilities
- All methods are static, no instance state maintained

**Core Methods:**

- **factorial(int n) (L9-14)**: Recursive factorial computation with base case (n <= 1)
  - Returns 1 for edge cases, otherwise computes n * factorial(n-1)
  - No overflow protection or negative input validation

- **sumArray(int[] numbers) (L19-25)**: Array summation using enhanced for-loop
  - Iterates through array accumulating total
  - No null safety checks

- **processData(int[] data) (L30-37)**: Array transformation applying doubling operation
  - Creates new result array of same length
  - Transforms each element by multiplying by 2
  - Returns new array, original unchanged

- **main(String[] args) (L42-74)**: Demonstration driver showcasing all utility methods
  - Tests basic arithmetic (x=10, y=20, z=30)
  - Computes factorial(5) = 120
  - Sums array [1,2,3,4,5] = 15
  - Processes [10,20,30] → [20,40,60]
  - Final computation: z * factResult = 30 * 120 = 3600

### Data Flow
1. Initialize test variables and perform basic arithmetic
2. Execute factorial computation 
3. Perform array summation
4. Apply data transformation (doubling)
5. Combine results in final computation
6. Output all intermediate and final results

### Notable Patterns
- Pure functions with no side effects (except main's console output)
- Consistent parameter validation absent across methods
- Standard array iteration patterns (indexed and enhanced for-loops)
- Progressive complexity from simple arithmetic to array operations