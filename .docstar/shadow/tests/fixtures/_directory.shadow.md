# tests/fixtures/
@generated: 2026-02-10T21:26:50Z

## Overall Purpose

The `tests/fixtures` directory serves as a comprehensive test fixture ecosystem for validating debugging tools, development workflows, and MCP Server functionality across multiple programming languages and debugging scenarios. This collection provides controlled, predictable test environments that enable automated testing of debugging capabilities, protocol implementations, and tool integrations.

## Key Components & Integration

The directory is organized into three specialized subdirectories that work together to provide comprehensive debugging test coverage:

**Debug Scripts (`debug-scripts/`)**
- Minimal, focused test fixtures for basic debugging scenarios
- Provides both JavaScript (`simple-mock.js`) and Python (`simple.py`, `with-variables.py`, `with-errors.py`) fixtures
- Supports testing of step-through debugging, variable inspection, exception handling, and mock adapter implementations

**JavaScript E2E Testing (`javascript-e2e/`)**  
- TypeScript-based fixtures for end-to-end debugging workflows
- Contains `app.ts` with source map support and strategic breakpoint markers
- Enables validation of JavaScript/TypeScript debugging tools and development environments

**Python Testing Infrastructure (`python/`)**
- Comprehensive Python debugging test suite combining debuggee targets and mock infrastructure
- `debug_test_simple.py` serves as a controlled debugging target with predictable execution flow
- `debugpy_server.py` provides mock DAP (Debug Adapter Protocol) server for protocol testing

## Public API Surface & Entry Points

**For Basic Debugging Tests:**
- All fixtures provide standalone execution with `main()` functions or direct execution patterns
- Comment-based breakpoint markers (`// BREAK_HERE`, strategic line positions) for automated testing
- Predictable console outputs for verification and assertion testing

**For Advanced Debugging Workflows:**
- TypeScript compilation and source map generation through `javascript-e2e/app.ts`
- DAP server mock at `python/debugpy_server.py` (standard port 5678) with command-line interface
- Controlled debuggee target at `python/debug_test_simple.py` with known variable scopes

**For Protocol and Integration Testing:**
- Socket-based DAP message handling and capability negotiation
- Cross-language debugging scenario support (Python and JavaScript/TypeScript)
- Mock adapter interfaces for testing without production dependencies

## Internal Organization & Data Flow

The fixtures follow a layered testing approach:

1. **Unit-Level Testing**: `debug-scripts/` provides isolated, minimal test cases for specific debugging features
2. **Integration Testing**: `javascript-e2e/` enables end-to-end workflow validation with real toolchain integration
3. **Protocol Testing**: `python/` combines mock infrastructure with real debuggee targets for comprehensive debugging protocol validation

## Testing Patterns & Conventions

- **Minimal Complexity**: All fixtures avoid unnecessary dependencies and complexity to prevent test environment interference
- **Predictable Behavior**: Deterministic execution flows and known outputs enable reliable automated testing
- **Language Coverage**: Supports both Python and JavaScript/TypeScript debugging ecosystems
- **Protocol Compliance**: Proper DAP message framing and standard debugging conventions
- **Isolation**: Self-contained fixtures that don't interfere with production systems

This fixture collection enables comprehensive validation of debugging tools, MCP Server implementations, and development workflows by providing the complete testing infrastructure needed from basic breakpoint testing to full protocol compliance validation.