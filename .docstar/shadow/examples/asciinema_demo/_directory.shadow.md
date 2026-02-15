# examples\asciinema_demo/
@children-hash: 33753f4e3f0e8bb9
@generated: 2026-02-15T09:01:28Z

## Overall Purpose

The `asciinema_demo` directory provides a comprehensive demonstration of MCP (Model Context Protocol) debugging capabilities through a rich terminal UI. It showcases an end-to-end debugging workflow that combines intentionally buggy code with an interactive debugger frontend, designed for recording asciinema demos or live demonstrations of debugging tools.

## Key Components & Relationships

**buggy_event_processor.py** - The debugging target containing an event processing system with intentional copy/reference bugs. Features:
- Event transformation pipeline with shallow copy protection issues
- Special revert logic that demonstrates reference vs. copy problems
- Built-in test data and verification logic to expose bugs
- Realistic business logic (priority classification, value transformations) with subtle flaws

**run_rich_demo.py** - The MCP debugging client providing an interactive terminal UI. Features:
- Rich-based split-pane layout (debug logs + syntax-highlighted code)
- MCP server communication via subprocess and JSON protocol
- Real-time breakpoint management and execution line tracking
- Automated demo workflow orchestration

## Public API Surface

**Main Entry Point:**
- `run_rich_demo.py` - Execute via `python run_rich_demo.py` to launch the full demo

**Demo Workflow API:**
- Session management: `create_debug_session`, session cleanup
- Breakpoint control: Set breakpoints at specific lines
- Execution control: `start_debugging` with event processing
- State inspection: Stack trace requests and variable examination

**Target Code API:**
- `process_events(events, important_threshold=5)` - Main processing function demonstrating bugs
- `initial_events_data` - Pre-configured test dataset
- Built-in verification logic to detect and report bugs

## Internal Organization & Data Flow

**Setup Phase:**
1. Validates file paths (target script, MCP server binary)
2. Launches Node.js MCP server as subprocess with JSON communication
3. Initializes Rich UI with three-panel layout

**Demo Execution Flow:**
1. Creates MCP debug session targeting `buggy_event_processor.py`
2. Sets breakpoint at line 13 (event enrichment logic)
3. Starts debugging session and processes test events
4. Handles debug events (breakpoints, execution stops) with UI updates
5. Performs cleanup and graceful shutdown

**Communication Pattern:**
- Synchronous MCP requests with incremental IDs
- Asynchronous event handling for breakpoints and execution state
- Real-time UI updates reflecting debug state changes

## Important Patterns & Conventions

**Bug Demonstration Strategy:**
- Intentional shallow copy issues in event processing
- Reference vs. copy problems in revert logic
- Built-in verification to detect when bugs manifest

**UI Update Pattern:**
- Immediate log message appending with style formatting
- Code pane refresh showing breakpoints ("B>") and execution highlights ("H>")
- Synchronous screen updates after major operations

**MCP Protocol Usage:**
- JSON-RPC style communication with Node.js server
- Tool-based API (create_debug_session, set_breakpoint, etc.)
- Event-driven updates for debugging state changes

**Error Handling:**
- Progressive server shutdown (wait → terminate → kill)
- File validation before execution
- Exception handling for JSON parsing and subprocess errors

## Demo Context

This directory serves as a complete, self-contained example for demonstrating MCP debugging capabilities in terminal recordings or live presentations. The buggy code provides realistic debugging scenarios while the Rich UI creates an engaging visual experience suitable for developer tool demonstrations.