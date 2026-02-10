# tests/adapters/python/
@generated: 2026-02-10T21:26:50Z

## Test Suite for Python Debugger Adapter

**Overall Purpose**: Comprehensive test coverage for the Python debugger adapter component of the debugmcp system. This directory provides both unit and integration testing to ensure reliable Python environment discovery, debugging session management, and cross-platform compatibility across Windows, Linux, and macOS systems.

### Component Architecture and Relationships

**Unit Tests (`unit/`)** - Foundation Layer Testing
- `python-utils.test.ts` - Core utility function validation
- Tests Python executable discovery, version detection, and command finding
- Uses comprehensive mocking infrastructure for platform isolation
- Validates cross-platform behavior without OS dependencies

**Integration Tests (`integration/`)** - End-to-End Validation
- `env-utils.ts` - Python environment management utilities
- `python-discovery.test.ts` - Real-world Python discovery testing
- `python_debug_workflow.test.ts` - Complete debugging workflow validation
- Tests actual MCP client-server communication without mocks

### Testing Strategy and Data Flow

1. **Unit Layer**: Mock-based testing validates core utilities in isolation
   - Platform-specific logic testing through stubbed environments
   - Comprehensive error condition coverage
   - Dependency injection patterns for command discovery

2. **Integration Layer**: Real implementation testing with live Python environments
   - Environment preparation ensures Python + debugpy availability
   - End-to-end debugging workflows through MCP protocol
   - CI-focused with extensive diagnostic logging

### Public API Surface

**Unit Test Entry Points:**
- Cross-platform Python executable discovery testing
- Python version detection validation
- Command finder configuration testing
- Mock infrastructure for EventEmitter-based process simulation

**Integration Test Entry Points:**
- `ensurePythonOnPath(env)` - Python environment setup utility
- Full debugging workflow test suites
- MCP client-server communication validation
- Python discovery capability testing

**Shared Test Utilities:**
- `parseToolResult()` - MCP response parsing
- `waitForStackFrames()` - Async debug state polling
- `persistFailurePayload()` - CI debugging artifact collection
- `MockCommandFinder` - Command resolution testing

### Key Testing Patterns

**Platform Coverage Strategy:**
- Parameterized testing across win32, linux, darwin platforms
- Windows-specific: py launcher, Microsoft Store detection, where.exe usage
- Unix-like: python3 → python fallback chains, which command resolution
- Environment variable precedence testing (PYTHON_PATH, PYTHON_EXECUTABLE, pythonLocation)

**Mock vs Real Testing Philosophy:**
- Unit tests: Comprehensive mocking for isolated component validation
- Integration tests: No mocks policy for real-world behavior validation
- Progressive testing from isolated components to complete workflows

**Error Handling Validation:**
- Missing executable scenarios and spawn error conditions
- Network issues, invalid responses, and timeout handling
- CommandNotFoundError and adapter-specific exception testing

### System Integration Role

This test directory ensures the Python adapter can reliably function across diverse deployment environments by validating both isolated utility functions and complete debugging workflows. The dual-layer approach (unit + integration) provides confidence that the adapter will successfully discover Python installations, establish debugging sessions, and execute debugging operations through the MCP protocol in production environments.