# docs\debugAdapterProtocol.json
@source-hash: d031b82108e3bf70
@generated: 2026-02-24T01:54:21Z

## Debug Adapter Protocol JSON Schema

This JSON Schema defines the complete Debug Adapter Protocol (DAP) specification, providing runtime validation for all messages, requests, responses, and events between debug clients and debug adapters.

### Core Protocol Structure

**Base Protocol Messages (L10-26)**: `ProtocolMessage` defines the foundational structure with sequence numbering and message type classification (request, response, event).

**Request/Response Pattern**: 
- `Request` (L28-48): Client-initiated commands with command name and optional arguments
- `Response` (L72-109): Acknowledgments with success indicators and optional result data
- `Event` (L50-70): Debug adapter notifications with event type and payload
- `ErrorResponse` (L111-128): Structured error reporting with detailed failure information

### Core Operations

**Session Management**:
- `InitializeRequest/Response` (L877-981): Capability negotiation and adapter configuration
- `LaunchRequest` (L1010-1045) / `AttachRequest` (L1047-1078): Starting debug sessions
- `DisconnectRequest` (L1116-1155) / `TerminateRequest` (L1157-1188): Ending sessions

**Execution Control**:
- `ContinueRequest` (L1635-1683): Resume execution with thread control
- Stepping operations: `NextRequest` (L1685-1725), `StepInRequest` (L1727-1771), `StepOutRequest` (L1773-1813)
- `PauseRequest` (L1968-2000): Suspend execution
- Reverse debugging: `StepBackRequest` (L1815-1855), `ReverseContinueRequest` (L1857-1894)

**Breakpoint Management**:
- Source breakpoints: `SetBreakpointsRequest` (L1257-1323) using `SourceBreakpoint` (L3810-3840)
- Function breakpoints: `SetFunctionBreakpointsRequest` (L1325-1376) 
- Data breakpoints: `SetDataBreakpointsRequest` (L1525-1576) with access type control
- Instruction breakpoints: `SetInstructionBreakpointsRequest` (L1578-1633)

**State Inspection**:
- `StackTraceRequest` (L2002-2066): Retrieve call stack with paging support
- `ScopesRequest` (L2068-2116): Get variable scopes for stack frames  
- `VariablesRequest` (L2118-2183): Enumerate variables with hierarchical structure
- `EvaluateRequest` (L2495-2600): Expression evaluation in debugging context

### Event Notifications

**Execution Events**:
- `StoppedEvent` (L182-232): Execution halt with reason and thread information
- `ContinuedEvent` (L234-260): Execution resume notification
- `ThreadEvent` (L309-336): Thread lifecycle changes

**Output and Progress**:
- `OutputEvent` (L338-406): Debuggee output with categorization and formatting
- Progress events: `ProgressStartEvent`, `ProgressUpdateEvent`, `ProgressEndEvent` (L568-670)

**State Changes**:
- `BreakpointEvent` (L408-435): Breakpoint modifications
- `InvalidatedEvent` (L672-704): Cache invalidation notifications

### Advanced Features

**Memory Operations**:
- `ReadMemoryRequest` (L2918-2978) / `WriteMemoryRequest` (L2980-3039): Direct memory access
- `DisassembleRequest` (L3041-3104): Assembly code generation

**Terminal Integration**:
- `RunInTerminalRequest` (L738-815): Launch processes in client terminals

**Source Management**:
- `SourceRequest` (L2268-2321): Retrieve source code by reference
- `LoadedSourcesRequest` (L2452-2493): Query available source files

### Type System

**Core Types**:
- `Capabilities` (L3168-3357): Feature matrix for client/adapter negotiation
- `Source` (L3524-3568): Source file descriptors with references
- `StackFrame` (L3570-3621): Call stack entries with location information
- `Variable` (L3682-3732): Variable representation with type hints
- `Breakpoint` (L3920-3971): Breakpoint state with verification status

**Formatting and Presentation**:
- `ValueFormat` (L4124-4133): Value display options
- `VariablePresentationHint` (L3734-3784): UI rendering hints for variables
- `StackFrameFormat` (L4135-4170): Stack frame display customization

The schema enforces strict validation of all protocol messages while supporting extensive customization through capability flags and optional extensions.