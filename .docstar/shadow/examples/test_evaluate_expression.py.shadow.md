# examples/test_evaluate_expression.py
@source-hash: b4e7d897bc3216ec
@generated: 2026-02-10T00:41:58Z

## Purpose
Test script designed to demonstrate expression evaluation functionality in a debugger context. Creates various variable types and scope contexts with strategically placed breakpoint locations for testing debugger expression evaluation capabilities.

## Key Functions

### `test_function(x, y)` (L7-20)
- **Purpose**: Creates nested function scope for testing expression evaluation in different stack frames
- **Variables**: 
  - `local_var` (L9): Simple arithmetic result
  - `nested_list` (L10): Multi-level list structure `[1, 2, [3, 4, 5]]`
  - `nested_dict` (L11-17): Complex nested dictionary with string keys and mixed value types
- **Breakpoint Location**: L18 comment indicates intended breakpoint for function scope testing
- **Returns**: `result` (doubled local_var value)

### `main()` (L22-47)
- **Purpose**: Primary test orchestrator creating diverse variable types and execution contexts
- **Variables**:
  - Simple types: `x=10`, `y=20`, `message` string (L25-27)
  - Collections: `my_list` (L30), `my_dict` (L31) 
  - Unicode: `unicode_var` with Chinese characters (L44)
- **Breakpoint Locations**: 
  - L33: Main scope evaluation
  - L39: Post-function call state testing
- **Flow**: Variable creation → function call → result processing → unicode testing

## Testing Strategy
- **Scope Testing**: Multiple stack frames (main vs function local)
- **Data Type Coverage**: Primitives, collections, nested structures, unicode
- **State Points**: Three distinct breakpoint locations for comprehensive evaluation testing
- **Frame Context**: Tests variable access across different execution contexts

## Dependencies
- Standard Python execution environment
- Intended for use with debugger tools that support expression evaluation

## Architectural Pattern
Classic test fixture pattern with deliberate breakpoint placement for interactive debugging scenarios. The script is structured to pause execution at meaningful points where variable state can be inspected and expressions evaluated.