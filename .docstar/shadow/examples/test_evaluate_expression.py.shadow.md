# examples/test_evaluate_expression.py
@source-hash: b4e7d897bc3216ec
@generated: 2026-02-09T18:15:11Z

## Purpose
Test script for demonstrating expression evaluation functionality in a debugger context. Creates variable-rich execution environments with explicit breakpoint markers for testing expression evaluation across different frame scopes.

## Key Functions

### test_function(x, y) (L7-20)
- **Purpose**: Creates nested data structures for testing expression evaluation in function scope
- **Variables**: 
  - `local_var` (L9): Sum of input parameters
  - `nested_list` (L10): Multi-level list structure [1, 2, [3, 4, 5]]
  - `nested_dict` (L11-17): Complex nested dictionary with 'name', 'value', and 'inner' keys
- **Breakpoint**: L18 comment indicates intended debugger breakpoint for function scope testing
- **Returns**: `local_var * 2` as final result

### main() (L22-47)
- **Purpose**: Primary test harness for expression evaluation across multiple variable types and scopes
- **Variables**:
  - Simple types: `x=10`, `y=20`, `message="Hello, debugger!"` (L25-27)
  - Collections: `my_list=[1,2,3,4,5]`, `my_dict={'a':1,'b':2,'c':3}` (L30-31)
  - Unicode: `unicode_var="测试中文"` (L44) for testing non-ASCII character evaluation
- **Breakpoints**: Comments at L33, L39 indicate intended debugger stops
- **Flow**: Calls `test_function()` and prints results to demonstrate frame context switching

## Execution Entry
- Standard `if __name__ == "__main__"` guard (L49-50) calls `main()`

## Testing Strategy
Script is designed for interactive debugging sessions where:
1. Breakpoint 1 (function scope): Test nested data structure access
2. Breakpoint 2 (main scope): Test simple variable evaluation
3. Breakpoint 3 (post-function): Test result inspection and Unicode handling

The variable diversity (primitives, collections, nested structures, Unicode) provides comprehensive test cases for expression evaluators handling different Python data types and scoping contexts.