# examples/go/hello_world.go
@source-hash: bbe284538cc17076
@generated: 2026-02-09T18:14:47Z

**Purpose**: Basic "Hello World" Go program demonstrating package structure, function definition, and string formatting.

**Structure**:
- Package: `main` (L1) - executable program entry point
- Import: `fmt` (L4) for formatted I/O operations

**Functions**:
- `greet(name string) string` (L7-9): Pure function that takes a name parameter and returns a formatted greeting string using `fmt.Sprintf`
- `main()` (L11-14): Program entry point that calls `greet("World")` and prints the result to stdout

**Execution Flow**:
1. `main` calls `greet` with "World" as argument (L12)
2. `greet` returns "Hello, World!" using string interpolation (L8)
3. Result is printed to console via `fmt.Println` (L13)

**Dependencies**: Standard library `fmt` package for string formatting and console output

**Pattern**: Simple demonstration of function composition and Go's basic syntax - typical introductory example for Go programming