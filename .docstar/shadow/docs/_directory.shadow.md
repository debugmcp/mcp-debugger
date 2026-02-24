# docs/
@children-hash: 0da3fc5f98dd6924
@generated: 2026-02-24T01:54:51Z

## Debug Adapter Protocol Documentation

This directory contains the official JSON Schema specification for the Debug Adapter Protocol (DAP), providing the complete protocol definition for standardized communication between debug clients (IDEs, editors) and debug adapters (language-specific debugging backends).

### Core Purpose

The directory serves as the authoritative source for DAP message validation and protocol understanding. The JSON Schema defines the contract that enables any debug client to communicate with any debug adapter using a standardized message format, regardless of programming language or debugging implementation.

### Protocol Architecture

**Message Foundation**: All communication follows a base `ProtocolMessage` structure with sequence numbering, supporting three core message types:
- **Requests**: Client-initiated commands (initialize, launch, set breakpoints, step, etc.)
- **Responses**: Adapter acknowledgments with success/failure status and optional data
- **Events**: Adapter-initiated notifications about state changes (stopped, output, thread changes)

**Session Lifecycle**: The protocol enforces a structured debugging session flow:
1. Capability negotiation through `InitializeRequest/Response`
2. Session establishment via `LaunchRequest` or `AttachRequest`  
3. Active debugging with execution control and state inspection
4. Clean termination through `DisconnectRequest` or `TerminateRequest`

### Key Functional Areas

**Execution Control**: Comprehensive execution management including continue, step operations (in/out/over), pause, and reverse debugging capabilities with precise thread control.

**Breakpoint Management**: Multi-modal breakpoint support including source line breakpoints, function breakpoints, data breakpoints with access type control, and instruction-level breakpoints.

**State Inspection**: Hierarchical debugging state access through stack traces, variable scopes, and expression evaluation with support for large data sets via pagination and lazy loading.

**Advanced Features**: Memory manipulation (read/write), disassembly, terminal integration for launching processes, and dynamic source code retrieval.

### Public API Surface

The schema defines a complete protocol specification that debug tool implementers use to:
- Validate message conformance during development
- Generate type-safe protocol bindings for various programming languages
- Ensure interoperability between different debug clients and adapters
- Reference canonical message structures and capability flags

### Protocol Extensibility

The specification includes extensive capability negotiation mechanisms and optional feature flags, allowing implementations to support subsets of functionality while maintaining compatibility. Custom extensions can be added through optional fields and vendor-specific capabilities.

This documentation serves as both a validation tool and implementation guide for the entire debug tooling ecosystem.