# tests/validation/breakpoint-messages/test_syntax_error.py
@source-hash: 52d944f77f29fae7
@generated: 2026-02-09T18:14:41Z

## Purpose
Test file designed to validate syntax error handling in breakpoint message validation system. Contains intentional syntax errors to test error detection and reporting mechanisms.

## Structure
- **Variable declarations (L2-3)**: Basic integer assignments `x = 10`, `y = 20`
- **Malformed function (L4-5)**: `broken_function` with missing closing parenthesis in definition, causing syntax error
- **Post-error code (L8)**: Variable assignment `z = x + y` demonstrating code after syntax error

## Key Elements
- **broken_function (L4-5)**: Intentionally malformed function definition missing closing parenthesis, followed by print statement that becomes syntactically invalid
- **Test variables (L2-3, L8)**: Simple arithmetic variables used to test parsing behavior around syntax errors

## Testing Strategy
File serves as negative test case for syntax validation, ensuring error detection systems properly identify and handle malformed Python syntax while processing surrounding valid code.

## Dependencies
None - standalone test file with basic Python constructs.