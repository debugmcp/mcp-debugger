# examples/
@generated: 2026-02-12T21:06:30Z

## Purpose and Responsibility

The `examples` directory serves as a comprehensive demonstration and testing suite for the MCP (Model Context Protocol) debugger ecosystem. It provides practical examples, educational materials, and integration tests that showcase debugging capabilities across multiple programming languages while serving as both learning resources and validation tools for MCP debugging infrastructure.

## Key Components and Integration

The directory is organized into several interconnected modules that demonstrate different aspects of MCP debugging:

### Language-Specific Testing Suites
- **python/**: Comprehensive Python debugging scenarios from basic variable operations to complex algorithmic patterns
- **javascript/**: Full JavaScript/TypeScript debugging validation including async operations, source maps, and Node.js scenarios  
- **go/**: Educational Go programming examples progressing from basics to advanced concurrency patterns
- **rust/**: Rust development demonstrations covering synchronous fundamentals to asynchronous programming

### Live Demonstration Systems
- **visualizer/**: Advanced terminal-based UI system that provides real-time visualization of MCP debugging sessions through Rich-based panels showing code execution, breakpoints, and tool activities
- **asciinema_demo/**: Complete interactive debugging workflow demonstration using a Rich terminal UI to debug intentionally buggy Python code, showcasing copy/reference bug detection
- **demo/**: Recording and presentation infrastructure for creating professional documentation materials and marketing assets

### Agent and Automation Examples
- **agent_demo.py**: Autonomous LLM agent that demonstrates systematic debugging workflows using MCP tools, following predefined action plans to create sessions, set breakpoints, and inspect execution state
- **python_simple_swap/**: Client-server debugging demonstration showing MCP protocol integration where one script orchestrates the debugging of another containing intentional bugs

### Testing and Validation Infrastructure
- **debugging/**: Comprehensive test scripts and integration tests validating MCP debugger functionality across JavaScript and Python runtimes, including critical timing bug fixes for SSE debugging scenarios

## Public API Surface

### Primary Entry Points
- **Live Visualization**: `visualizer/live_visualizer.py` for real-time MCP session monitoring
- **Complete Demos**: `asciinema_demo/run_rich_demo.py` and `demo/record_demo.sh` for full debugging demonstrations
- **Agent Simulation**: `agent_demo.py` for autonomous debugging workflow examples
- **Language Testing**: Individual test scripts in each language directory for focused debugging scenarios

### Integration Points
- **MCP Server Communication**: HTTP/JSON-RPC 2.0 protocol implementation across multiple examples
- **Session Management**: Consistent patterns for debug session lifecycle management with proper cleanup
- **Multi-Language Support**: Debugging examples spanning Python, JavaScript/TypeScript, Go, and Rust environments
- **UI Components**: Rich-based terminal interfaces with standardized panels and visual markers

## Internal Organization and Data Flow

### Demonstration Architecture
The examples follow a layered approach:
1. **Foundation Layer**: Simple test scripts in each language for basic debugging validation
2. **Integration Layer**: Complete client-server debugging scenarios with MCP protocol communication
3. **Visualization Layer**: Rich terminal UIs that transform debugging data into interactive experiences
4. **Automation Layer**: Agent-driven debugging workflows that simulate AI-assisted development

### Common Patterns
- **Educational Progression**: Examples progress from simple to complex scenarios within each category
- **Debugging-Friendly Design**: Strategic breakpoint placement, observable state changes, and clear execution flows
- **Protocol Consistency**: Standardized MCP communication patterns across all integration examples
- **Resource Management**: Proper session cleanup, subprocess lifecycle management, and error handling
- **Multi-Modal Output**: Support for terminal interfaces, file logging, and recording/conversion pipelines

## Educational and Testing Value

This directory serves multiple audiences:
- **Developers**: Learning MCP debugger integration and debugging best practices
- **Tool Builders**: Reference implementations for MCP protocol usage and UI development
- **QA Engineers**: Comprehensive test suites for debugging tool validation
- **Documentation**: Professional demo materials for README files and marketing content

The examples collectively demonstrate the full capabilities of MCP debugging infrastructure while providing practical learning resources and robust testing coverage across multiple programming environments and use cases.