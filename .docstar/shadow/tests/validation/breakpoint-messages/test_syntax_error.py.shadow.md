# tests/validation/breakpoint-messages/test_syntax_error.py
@source-hash: aca52c71bae6da5b
@generated: 2026-02-10T01:18:51Z

## Purpose
Test fixture containing intentional Python syntax error for validation testing. Demonstrates broken function definition with missing closing parenthesis.

## Structure
- **Variables (L2-3)**: Basic integer assignments `x = 10`, `y = 20`
- **broken_function (L4-5)**: Intentionally malformed function with missing closing parenthesis in parameter list, contains unreachable print statement
- **Post-error code (L8)**: Variable assignment `z = x + y` that would be unreachable due to syntax error

## Key Characteristics
- **Syntax Error**: Missing closing parenthesis in function definition (L4) prevents file from parsing
- **Test Purpose**: Validates error handling and breakpoint message validation systems
- **Unreachable Code**: All code after L4 becomes unreachable due to syntax error

## Dependencies
None - standalone test fixture

## Testing Context
Located in `tests/validation/breakpoint-messages/` suggesting this is part of a test suite that validates how debugging/breakpoint systems handle syntax errors in source files.