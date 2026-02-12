# tests\fixtures\python/
@generated: 2026-02-12T21:00:51Z

## Overview

This directory contains Python test fixtures specifically designed to support debugging workflow testing in the MCP Server environment. The fixtures provide both target applications for debugging and mock debugging infrastructure to validate debugger functionality without requiring full debugpy installations.

## Key Components

### Debug Target Fixtures
- **debug_test_simple.py**: A minimal Python script designed as a debugging target
  - Provides predictable execution flow with clear breakpoint locations (line 13)
  - Contains local variables at different scopes for variable inspection testing
  - Implements both synchronous computation and timed operations for step debugging scenarios
  - Serves as a controlled environment for validating debugger attachment and inspection capabilities

### Debug Infrastructure Fixtures
- **debugpy_server.py**: Mock debugpy server implementing basic DAP (Debug Adapter Protocol)
  - Simulates debugpy server behavior for testing MCP Server debugpy connections
  - Handles standard DAP commands: initialize, launch, configurationDone, threads, disconnect
  - Provides proper message framing with Content-Length headers and JSON payloads
  - Enables testing of debugging protocol communication without full debugpy dependencies

## Public API and Entry Points

Both fixtures are designed for standalone execution:
- **debug_test_simple.py**: Run directly as a target for debugger attachment testing
- **debugpy_server.py**: Launch as a mock server on port 5678 (standard debugpy port) for protocol testing

## Internal Organization

The fixtures follow a complementary design pattern:
- **Target-side**: debug_test_simple.py provides the application being debugged
- **Infrastructure-side**: debugpy_server.py provides the debugging server interface

This separation allows for comprehensive testing of both debugger attachment workflows and debugging protocol communication.

## Testing Patterns

- **Minimal Dependencies**: Both fixtures use only standard library components to reduce test environment complexity
- **Predictable Behavior**: Linear execution flows and well-defined breakpoint locations for consistent test results
- **Protocol Compliance**: DAP-compliant message handling for realistic debugging scenario simulation
- **Graceful Lifecycle Management**: Proper signal handling and connection management for test harness integration

## Usage Context

These fixtures support integration testing of MCP Server debugging capabilities, allowing validation of debugger attachment, protocol communication, variable inspection, and execution control without requiring complex debugging target applications or full debugpy server installations.