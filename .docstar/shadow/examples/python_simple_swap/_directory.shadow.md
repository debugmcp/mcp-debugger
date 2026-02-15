# examples\python_simple_swap/
@children-hash: ed09809be14c0d90
@generated: 2026-02-15T09:01:22Z

## Overall Purpose
Educational demonstration directory showcasing MCP (Model Context Protocol) debugging capabilities through a complete debug workflow. The module demonstrates how to debug Python code remotely using an MCP debug server, featuring a deliberate bug scenario for hands-on learning.

## Key Components and Relationships

### Primary Components
- **`debug_swap_demo.py`**: Main demonstration script that acts as MCP debug client
- **`swap_vars.py`**: Target script containing an intentional variable swap bug for debugging practice

### Component Interaction Flow
1. `debug_swap_demo.py` establishes connection to MCP debug server
2. Creates debug session targeting `swap_vars.py`
3. Sets breakpoints and steps through the buggy swap function
4. Demonstrates variable inspection and state changes
5. Validates that the bug produces expected incorrect behavior

## Public API Surface

### Main Entry Point
- **`debug_swap_demo.py`**: Execute directly to run complete debug demonstration
  - Requires MCP debug server running on `localhost:3000/mcp`
  - Automatically orchestrates full debug workflow
  - Provides console output showing debug progression

### Educational Components
- **`swap_vars.py`**: Standalone buggy implementation for manual testing
  - Contains `swap_variables()` function with intentional logic error
  - Includes `main()` test harness with verification
  - Can be executed independently to observe bug behavior

## Internal Organization and Data Flow

### MCP Communication Pattern
1. **Session Management**: JSON-RPC 2.0 protocol with session ID tracking
2. **Debug Lifecycle**: create → breakpoint → start → inspect → step → continue → close
3. **State Inspection**: Stack frames, variable scopes, and value examination
4. **Error Handling**: Comprehensive validation of server responses

### Debug Workflow Structure
- Synchronous debugging with sleep delays for async operations
- Variable state validation before and after code execution
- Proper resource cleanup with session closure in finally blocks

## Important Patterns and Conventions

### MCP Protocol Implementation
- **Request Structure**: JSON-RPC 2.0 with UUID request IDs
- **Session Persistence**: HTTP session cookies maintain MCP server state
- **Tool Communication**: Structured tool calls with parameter validation
- **Error Propagation**: Server errors bubble up with context preservation

### Educational Design Patterns
- **Deliberate Bug Introduction**: Classic swap error (missing temporary variable)
- **Verification Testing**: Expected vs actual behavior validation
- **Debug Tracing**: Print statements for execution flow visibility
- **Resource Safety**: Proper cleanup and error handling

## Usage Context
This module serves as a practical example for:
- Learning MCP debug server integration
- Understanding remote debugging workflows
- Practicing bug identification and resolution
- Demonstrating proper debug session management

The directory provides a complete, self-contained debugging scenario that can be used for training, testing MCP debug servers, or as a template for more complex debugging implementations.