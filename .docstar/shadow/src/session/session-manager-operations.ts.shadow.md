# src/session/session-manager-operations.ts
@source-hash: ef9c4dcbdb01f9d3
@generated: 2026-02-10T01:19:07Z

## Purpose
SessionManagerOperations extends SessionManagerData to implement core debug operations including session lifecycle management, step debugging, breakpoint management, and expression evaluation. Handles both launch and attach scenarios with dry-run support.

## Key Classes & Components

### SessionManagerOperations Class (L49-1514)
Main class providing debug operation methods. Key responsibilities:
- Session initialization and proxy management
- Debug step operations (step over/into/out)
- Breakpoint management and verification
- Expression evaluation in debug context
- Process attachment/detachment

### EvaluateResult Interface (L35-44)
Defines structure for expression evaluation results with DAP compliance.

## Core Methods

### startDebugging() (L371-708)
Primary entry point for session initialization. Handles:
- Session state transitions (INITIALIZING → ACTIVE)
- Dry-run mode with timeout handling (L403-487)
- Normal debugging flow with policy-based handshakes (L494-514)
- Comprehensive error handling with proxy log capture (L606-707)

### startProxyManager() (L50-308)
Creates and configures proxy managers for debug adapters:
- Log directory setup and validation (L66-81)
- Adapter configuration and executable resolution (L129-204)
- Launch vs attach mode detection (L100-120)
- Toolchain validation handling (L162-181)

### Step Operations
- stepOver() (L796-836): Sends DAP 'next' command
- stepInto() (L838-878): Sends DAP 'stepIn' command  
- stepOut() (L880-920): Sends DAP 'stepOut' command
- _executeStepOperation() (L922-1039): Common step execution logic with event handling

### Breakpoint Management
- setBreakpoint() (L711-794): Creates and sends breakpoints to active sessions
- Handles verification and structured logging (L772-784)

### Expression Evaluation
- evaluateExpression() (L1116-1293): Evaluates expressions in debug context
- Automatic frame detection when frameId not provided (L153-198)
- Comprehensive error handling and type classification (L1279-1291)

### Process Attachment
- attachToProcess() (L1298-1408): Attaches to running processes
- Auto-detects JDWP suspend mode for Java (L1349-1365)
- Sets appropriate initial state based on stopOnEntry
- detachFromProcess() (L1413-1472): Handles clean detachment

## Key Dependencies
- Debug adapters via adapter registry (L140)
- ProxyManager for DAP communication (L298)
- Language-specific policies for handshakes (L495-514)
- File system operations for logging (L69)
- JDWP detection utilities (L1352)

## Error Handling Patterns
- Session termination checks throughout operations
- Comprehensive error capture with proxy logs (L608-641)
- Toolchain validation with continuation support (L170-178)
- Graceful fallbacks for missing frame contexts

## State Management
- Session state transitions through SessionState enum
- Lifecycle management via SessionLifecycleState
- Thread ID tracking for multi-threaded debugging
- Event-driven state updates via proxy manager events

## Notable Features
- Dry-run mode for command validation without execution
- Language-agnostic adapter pattern with policy overrides
- Structured debug logging for breakpoints and evaluation
- Timeout handling for step operations and dry runs
- Auto-detection of debug configuration parameters