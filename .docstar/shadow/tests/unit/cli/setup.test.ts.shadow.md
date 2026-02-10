# tests/unit/cli/setup.test.ts
@source-hash: e87f2ea21ffa5d8a
@generated: 2026-02-09T18:14:41Z

## Primary Purpose
Comprehensive unit test suite for CLI setup functionality in `src/cli/setup.js`. Tests CLI creation, stdio command configuration, SSE command configuration, and command integration behavior using Vitest framework.

## Test Structure

### CLI Creation Tests (L6-19)
- **`createCLI` test (L7-18)**: Validates that `createCLI` function creates Commander instance with correct name, description, and version properties

### Stdio Command Tests (L21-82) 
- **Configuration test (L22-47)**: Verifies `setupStdioCommand` creates stdio subcommand with correct description and two options:
  - `--log-level/-l`: Log level setting with default 'info'
  - `--log-file`: File logging option
- **Execution test (L49-64)**: Tests command handler is called with parsed options when stdio command runs
- **Default values test (L66-81)**: Ensures default log level 'info' is used when not specified

### SSE Command Tests (L84-153)
- **Configuration test (L85-116)**: Verifies `setupSSECommand` creates SSE subcommand with three options:
  - `--port/-p`: Port setting with default '3001'  
  - `--log-level/-l`: Log level with default 'info'
  - `--log-file`: File logging option
- **Execution test (L118-134)**: Tests handler receives correct parsed arguments
- **Default values test (L136-152)**: Validates default port '3001' and log level 'info' behavior

### Integration Tests (L155-170)
- **Default command test (L156-169)**: Confirms stdio command runs as default when no subcommand specified

## Key Dependencies
- **Vitest**: Testing framework with `describe`, `it`, `expect`, `vi` (L1)
- **Commander**: CLI framework being tested (L2)
- **Target module**: Imports `createCLI`, `setupStdioCommand`, `setupSSECommand`, handler types (L3)

## Testing Patterns
- Mock handlers using `vi.fn()` for isolated testing
- Command parsing simulation via `program.parseAsync()` with argv arrays
- Option validation through command introspection (`program.commands`, `options` arrays)
- Handler verification using `expect.objectContaining()` for partial argument matching

## Handler Types
Tests expect `StdioHandler` and `SSEHandler` function signatures that accept options object and additional parameters.