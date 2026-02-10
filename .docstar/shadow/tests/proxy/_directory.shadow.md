# tests/proxy/
@generated: 2026-02-09T18:16:12Z

## Purpose
The `tests/proxy` directory contains comprehensive test suites for the DAP (Debug Adapter Protocol) proxy system that enables multi-target debugging and adapter abstraction. These tests validate the proxy's ability to manage multiple debugging sessions, route commands appropriately, and provide adapter-specific behaviors through a policy pattern.

## Key Components and Architecture

### Core Components Under Test

**DapProxyWorker** - The main orchestrator that manages the entire proxy lifecycle including:
- State management (UNINITIALIZED → INITIALIZING → RUNNING/TERMINATED)
- Adapter policy selection based on script type and adapter commands
- Process spawning and DAP connection management
- Command routing and queueing
- Dry run mode for testing and validation

**ChildSessionManager** - Multi-session management abstraction that handles:
- Creation and lifecycle of child debug sessions
- Policy-driven command routing between parent and child sessions
- Breakpoint mirroring across sessions
- Event forwarding from children to parent

**DapClientBehavior** - Policy implementations that define adapter-specific behaviors:
- Reverse request handling (`startDebugging`, `runInTerminal`)
- Command routing decisions
- Configuration normalization
- Feature flag management

### Adapter Policy System

The tests validate three main policies:

**JavaScript Debug Adapter Policy**:
- Supports multi-target debugging with child session creation
- Routes execution commands (`threads`, `pause`, `continue`) to children
- Mirrors breakpoints across all active sessions
- Handles reverse `startDebugging` requests for new targets
- Normalizes adapter ID from 'javascript' to 'pwa-node'

**Python Adapter Policy**:
- Single-session model with no child session support
- Supports `runInTerminal` but rejects `startDebugging`
- No command routing or breakpoint mirroring
- Focused on simplicity and direct adapter communication

**Default Adapter Policy**:
- Minimal fallback behavior for unsupported adapters
- Provides basic structure without advanced features

### Data Flow and Integration

The proxy system follows this flow:
1. **Initialization**: DapProxyWorker selects appropriate adapter policy
2. **Connection**: Establishes DAP connection with adapter process
3. **Session Management**: ChildSessionManager handles multi-session scenarios
4. **Command Processing**: Policy-driven routing between parent/child sessions
5. **Event Propagation**: Forwards events from child sessions to parent
6. **Cleanup**: Graceful shutdown and resource cleanup

### Test Patterns and Utilities

**Mock Infrastructure**:
- `MockMinimalDapClient` - Simulates DAP client connections with event emission
- Mock factories for logger, filesystem, process spawner, and message sender
- Comprehensive mocking of external dependencies

**Testing Strategies**:
- Fake timers for timeout scenario validation
- Process.exit mocking to test error handling without terminating tests
- Complex state management with proper cleanup to prevent test interference
- Integration tests that exercise full proxy workflows

### Key Testing Scenarios

**Multi-Session Orchestration**:
- Child session creation and adoption race condition handling
- Duplicate session prevention
- Active session tracking and state management

**Command Routing Validation**:
- Policy-specific routing decisions
- Command queueing for JavaScript adapters
- Request/response correlation and timeout handling

**Error Handling**:
- Initialization failures and graceful degradation
- Adapter spawn failures and connection issues
- Timeout scenarios with appropriate error surfacing

**Lifecycle Management**:
- Proper initialization sequences with dry run support
- Clean shutdown behavior with multiple shutdown call handling
- Resource cleanup and process termination

## Public API Surface

The tests validate these main entry points:

**DapProxyWorker**:
- Constructor with configuration options
- `initialize()` - Setup with policy selection and adapter spawning
- Command handling interface compatible with DAP protocol
- `shutdown()` - Graceful termination and cleanup

**ChildSessionManager**:
- Child session creation and management
- Policy-driven command routing
- Breakpoint storage and mirroring
- Event forwarding mechanisms

**Adapter Policies**:
- Static `getDapClientBehavior()` methods returning behavior objects
- Reverse request handlers
- Configuration normalization
- Feature flag definitions

This directory ensures the proxy system correctly abstracts debugging complexity while providing reliable multi-target debugging capabilities across different language adapters.