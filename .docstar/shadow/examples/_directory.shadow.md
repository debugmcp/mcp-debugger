# examples/
@generated: 2026-02-09T18:21:28Z

## Overall Purpose and Responsibility

The `examples` directory serves as a comprehensive demonstration and testing ecosystem for the MCP (Model Context Protocol) Debugger project. It provides a complete collection of educational resources, test programs, and demonstration tools across multiple programming languages and debugging scenarios. This directory functions as both a learning resource for developers and a validation suite for the MCP debugging infrastructure.

## Key Components and Integration

### Multi-Language Test Suite
The directory contains extensive test programs across major programming languages:
- **Python examples**: From simple variable swapping (`python_simple_swap/`) to comprehensive debugging scenarios (`python/`), including educational scripts and MCP client demonstrations
- **JavaScript/TypeScript**: Complete test coverage (`javascript/`) including async debugging, source maps, and complex data structures
- **Rust**: Async programming patterns (`rust/async_example/`) and debugging-focused examples (`rust/hello_world/`) with cached dependencies
- **Java**: Debugger attachment workflows and step-through debugging practice programs
- **Go**: Educational progression from basic syntax to advanced concurrency patterns with goroutines

### MCP Protocol Demonstrations
- **Agent Demo** (`agent_demo.py`): Autonomous LLM agent that demonstrates complete MCP debugging workflows through predefined tool sequences
- **Debug Orchestration** (`python_simple_swap/debug_swap_demo.py`): End-to-end MCP client implementation showing session management and debugging automation
- **Rich Terminal Interface** (`asciinema_demo/`): Visual debugging demonstrations with syntax highlighting and real-time breakpoint management

### Visualization and User Experience
- **Live TUI System** (`visualizer/`): Complete terminal-based debugging interface with real-time log monitoring, code viewing, and variable inspection
- **Demo Recording Pipeline** (`demo/`): Automated recording and conversion tools for creating promotional materials and documentation
- **Interactive Demonstrations** (`debugging/`): Integration tests and regression validation for MCP debugging infrastructure

## Public API Surface and Entry Points

### Primary Demonstration Scripts
- **`agent_demo.py`**: Autonomous debugging agent demonstration
- **`visualizer/live_visualizer.py`**: Real-time TUI debugging interface
- **`asciinema_demo/run_rich_demo.py`**: Rich terminal debugging demonstration
- **`demo/record_demo.sh`**: Automated demo recording pipeline

### Language-Specific Test Programs
Each language directory provides self-contained examples:
- **Python**: `main()` functions with progressive complexity from simple swapping to comprehensive debugging scenarios
- **JavaScript**: Node.js executables with breakpoint markers and variable inspection points
- **Rust**: Cargo-based projects with async patterns and debugging-friendly architecture
- **Java**: Standard main methods for attachment testing and algorithmic debugging
- **Go**: Independent programs demonstrating concurrency and basic language features

### MCP Client Integration
- **HTTP JSON-RPC clients**: Direct MCP server communication with session management
- **Tool orchestration**: Automated debugging workflows including breakpoint setting, stepping, and variable inspection
- **Error handling**: Robust debugging session cleanup and error recovery patterns

## Internal Organization and Data Flow

### Educational Progression Architecture
The examples follow a structured learning path:
1. **Foundation**: Simple variable manipulation and basic debugging concepts
2. **Intermediate**: Algorithm implementation, data structure processing, and function-level debugging
3. **Advanced**: Async programming, concurrency patterns, and complex debugging scenarios
4. **Integration**: Complete MCP workflows, automated debugging, and visualization tools

### Component Relationships
- **Test Programs → MCP Clients → Visualization**: Test programs provide debugging targets, MCP clients orchestrate debugging sessions, visualization components provide user interfaces
- **Language Examples → Protocol Demonstrations**: Language-specific examples serve as targets for MCP protocol demonstrations
- **Mock Systems → Live Integration**: Mock demonstrations provide controlled environments while live integration shows real MCP server connectivity

### Shared Patterns and Conventions
- **Self-contained execution**: All examples run independently with minimal dependencies
- **Breakpoint-friendly design**: Strategic code organization optimized for debugging tool interaction
- **Educational output**: Console logging and structured output for learning visibility
- **Error resilience**: Graceful failure handling and session cleanup across all components

## Role in Larger MCP Ecosystem

This directory serves as the **complete reference implementation and validation suite** for MCP debugging capabilities. It provides:

- **Developer Onboarding**: Progressive examples from simple debugging concepts to advanced MCP integration
- **Tool Validation**: Comprehensive test cases for validating MCP debugger functionality across multiple languages
- **Documentation Materials**: Recording and visualization tools for creating educational content
- **Integration Templates**: Reference implementations for building MCP debugging clients and tools
- **Regression Testing**: Automated validation of debugging workflows and protocol implementations

The examples directory represents the practical application layer of the MCP Debugger project, bridging the gap between the protocol specification and real-world debugging workflows through hands-on demonstrations and comprehensive testing infrastructure.