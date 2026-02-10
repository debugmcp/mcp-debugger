# tests/test-utils/fixtures/python/
@generated: 2026-02-10T21:26:14Z

## Python Test Fixtures Directory

This directory contains Python test fixture scripts designed to support debugging and process monitoring test scenarios, particularly for testing MCP (Model Context Protocol) server debugging capabilities and test harness behavior.

### Overall Purpose
The fixtures provide controlled, predictable test environments for validating:
- Debugger attachment and interaction workflows
- Long-running process monitoring capabilities  
- MCP server debugging infrastructure using Debug Adapter Protocol (DAP)
- Test harness behavior with extended execution scenarios

### Key Components

**debug_test_simple.py** - Basic Debug Target
- Simple, long-running test process (60-second execution)
- Predictable computation flow for verification
- Designed for external debugger/monitor attachment testing
- Minimal dependencies (sys, time)

**debugpy_server.py** - DAP Debug Server
- Full-featured debugpy server implementation for MCP testing
- Configurable host/port binding (default: 127.0.0.1:5679)
- Built-in test scenarios with programmatic breakpoints
- CLI interface for flexible test configuration

### Public API Surface

**Entry Points:**
- `debug_test_simple.py`: Direct script execution for basic debugging scenarios
- `debugpy_server.py`: CLI-driven server with multiple execution modes
  - Server mode (default): Persistent debugging server
  - Test mode (--run-test): Fibonacci calculation with breakpoints

**Key Configuration:**
- Debugpy server: Host/port customization, client wait behavior
- Extended execution timing for attachment window

### Internal Organization

**Data Flow:**
1. **Simple Debug Target**: Linear execution → computation → extended sleep
2. **Debug Server**: Server initialization → client connection handling → test scenario execution

**Integration Pattern:**
- `debug_test_simple.py` serves as a passive debug target
- `debugpy_server.py` acts as active debug server for MCP client connections
- Both provide controlled environments with predictable execution flows

### Important Patterns

**Debugging Architecture:**
- Follows correct debugpy server pattern (this side listens, MCP servers connect as DAP clients)
- Non-standard port usage (5679) to avoid conflicts
- Graceful error handling and import validation

**Test Design:**
- Extended execution windows for external tool attachment
- Predictable computation flows for breakpoint testing
- Configurable wait behaviors for different test scenarios
- Simple, isolated functionality for reliable testing

This fixture directory enables comprehensive testing of debugging workflows in MCP environments while providing both basic and advanced debugging scenarios.