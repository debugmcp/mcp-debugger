# examples/go/hello_world/main.go
@source-hash: e75cb995236cfff6
@generated: 2026-02-10T00:41:19Z

## Purpose
Educational Go example demonstrating basic language features and syntax patterns for the MCP Debugger tool (v0.17.0). Serves as a comprehensive Hello World program showcasing fundamental Go constructs.

## Key Functions

**main() (L7-52)**
- Entry point demonstrating variable declarations, function calls, collections, control flow, and output formatting
- Uses string interpolation with `fmt.Printf` for structured output
- Demonstrates both slice and map iteration patterns
- Contains conditional logic and loop examples

**add(a, b int) int (L54-57)**
- Simple arithmetic function taking two integers and returning their sum
- Called from main() to demonstrate function invocation and parameter passing

**greet(name string) string (L59-61)**
- String formatting utility using `fmt.Sprintf` to create personalized greeting messages
- Returns formatted welcome message incorporating the input name parameter

## Dependencies
- Standard library `fmt` package for formatted I/O operations

## Data Structures & Patterns
- **Variables**: String and integer declarations using short variable syntax (`:=`)
- **Collections**: Integer slice `[]int{1,2,3,4,5}` (L25) and string-to-string map for color codes (L29-33)
- **Control Flow**: Range-based map iteration (L35-37), conditional branching (L40-44), and traditional for loop (L47-49)

## Output Behavior
Produces structured console output including:
- Welcome message with application name and version
- Arithmetic operation results
- Personalized greetings
- Collection contents
- Color code mappings
- Conditional evaluation results
- Loop iteration counters