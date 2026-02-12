# examples/
@generated: 2026-02-11T23:48:26Z

## Overall Purpose and Responsibility

The `examples` directory serves as a comprehensive demonstration, testing, and educational suite for the MCP (Model Context Protocol) Debugger ecosystem. It provides practical examples showcasing debugging capabilities across multiple programming languages, complete with interactive demonstrations, testing harnesses, and visualization tools that demonstrate how MCP-based debugging works in real-world scenarios.

## Key Components and Integration

### Language-Specific Testing Suites
- **JavaScript/TypeScript**: Comprehensive test scripts covering ES6+ features, async patterns, recursion, and source map debugging
- **Python**: Progressive complexity test cases from simple variable operations to recursive algorithms, with intentional bugs for debugging practice
- **Go**: Educational examples demonstrating concurrency patterns, algorithm implementations, and goroutine debugging scenarios  
- **Rust**: Foundational and advanced async programming examples optimized for debugging workflow validation

### Live Demonstration Infrastructure
- **Agent Demo (`agent_demo.py`)**: Autonomous LLM agent that executes complete debugging workflows programmatically, demonstrating MCP tool orchestration
- **Visualizer Suite**: Rich terminal UI system providing real-time visualization of debugging sessions with syntax highlighting, breakpoint markers, and variable inspection
- **Asciinema Demo**: Professional recording and conversion pipeline for creating documentation materials

### Specialized Testing Components  
- **Python Simple Swap**: Complete educational module demonstrating intentional bug identification through systematic MCP debugging
- **Debugging Directory**: Integration test suite validating timing-critical operations and SSE-based debugging scenarios
- **Demo Directory**: Theatrical presentation system with recording infrastructure for README and promotional content

## Public API Surface and Entry Points

### Primary Demonstration Modes
- **`python agent_demo.py`**: Autonomous debugging agent executing predefined workflow
- **`python visualizer/live_visualizer.py`**: Real-time debugging session visualization 
- **`python visualizer/demo_mock.py`**: Standalone debugging demo without external dependencies
- **`bash demo/record_demo.sh`**: Professional documentation recording pipeline

### Language Test Runners
Each language directory provides standalone executables:
- **JavaScript**: Node.js executable scripts with shebang headers
- **Python**: Direct execution via `python script.py` or `if __name__ == "__main__"`
- **Go**: Cargo-based execution via `cargo run` in respective subdirectories
- **Rust**: Standard Rust toolchain integration

### Educational Entry Points
- **Simple Examples**: Basic variable operations and control flow (`*_simple_*.py`, `hello_world.*`)
- **Comprehensive Tests**: Multi-scenario debugging validation (`*_comprehensive.*`, `*_test_debug.*`)
- **Advanced Patterns**: Async programming, concurrency, and complex data structures

## Internal Organization and Data Flow

The examples follow a pedagogical architecture with three complexity tiers:

1. **Foundation Level**: Simple variable operations, basic breakpoints, and single-file debugging scenarios
2. **Intermediate Level**: Multi-function programs, algorithm implementation, and state inspection
3. **Advanced Level**: Concurrent programming, async patterns, and complex debugging workflows

### Cross-Component Integration
- **MCP Protocol Communication**: Standardized JSON-RPC 2.0 communication patterns across all demonstrations
- **Session Management**: Consistent session lifecycle management with proper cleanup across all tools
- **State Synchronization**: Real-time debugging state propagation between servers, agents, and visualizers

### Common Data Flow Pattern
```
Example Target Script → MCP Debug Server → Client/Agent/Visualizer → 
User Interaction → Debug Commands → State Updates → Visual Feedback
```

## Important Patterns and Conventions

### Educational Design Philosophy
- **Intentional Bug Injection**: Strategic placement of common programming errors for debugging practice
- **Progressive Complexity**: Graduated difficulty from basic variable inspection to advanced concurrent debugging
- **Self-Contained Examples**: No external dependencies beyond standard language toolchains and MCP servers

### Debugging Optimization
- **Strategic Breakpoint Placement**: Comments marking optimal debugging locations across all examples
- **Variable Diversity**: Mixed data types (primitives, collections, nested structures) for comprehensive inspection testing
- **Predictable Execution Flow**: Deterministic behavior enabling reliable debugging session reproduction

### Integration Standards
- **Consistent Tool Communication**: Standardized MCP tool invocation patterns across all client implementations
- **Session Lifecycle Management**: Proper creation, maintenance, and cleanup of debugging sessions
- **Error Handling**: Graceful degradation with comprehensive error recovery across all components

This directory serves as the definitive showcase for MCP debugging capabilities, providing both educational resources for learning debugging concepts and practical reference implementations for MCP integration patterns across multiple programming languages and debugging scenarios.