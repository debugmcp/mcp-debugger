# tests/unit/cli/setup.test.ts
@source-hash: e87f2ea21ffa5d8a
@generated: 2026-02-10T00:41:29Z

## Purpose
Comprehensive unit tests for CLI setup functionality, validating command creation, configuration, and execution behavior of both stdio and SSE transport modes.

## Test Structure

### Core CLI Tests (L6-19)
- **createCLI test (L7-18)**: Validates CLI command instance creation with name, description, and version configuration

### Stdio Command Tests (L21-82)
- **Configuration validation (L22-47)**: Verifies stdio command setup with correct options:
  - `--log-level/-l` option with default 'info' (L37-43)
  - `--log-file` option for file logging (L38, L45-46)
- **Execution tests (L49-81)**: Tests command handler invocation with custom and default log levels

### SSE Command Tests (L84-153)
- **Configuration validation (L85-116)**: Verifies SSE command setup with three options:
  - `--port/-p` option with default '3001' (L100, L104-107)
  - `--log-level/-l` option with default 'info' (L101, L109-112)
  - `--log-file` option for file logging (L102, L114-115)
- **Execution tests (L118-152)**: Tests command handler invocation with custom and default values

### Integration Tests (L155-170)
- **Default command behavior (L156-169)**: Validates stdio as default command when no subcommand specified

## Key Dependencies
- **vitest**: Testing framework with mocking capabilities
- **commander**: Command-line interface library being tested
- **CLI setup module**: Imports `createCLI`, `setupStdioCommand`, `setupSSECommand`, and handler types

## Testing Patterns
- Mock handlers using `vi.fn()` with async resolution
- Command parsing via `program.parseAsync()` with simulated argv
- Option validation through command introspection
- Handler verification using `expect.objectContaining()` for partial matching

## Transport Modes Tested
- **Stdio**: Standard input/output transport with logging configuration
- **SSE**: Server-Sent Events transport with port and logging configuration