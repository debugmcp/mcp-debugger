# examples/
@generated: 2026-02-10T21:27:16Z

## Overall Purpose and Responsibility

The `examples` directory serves as a comprehensive demonstration, testing, and educational resource for the MCP (Model Context Protocol) debugger. It provides complete debugging workflows, multi-language test suites, interactive visualizations, and practical implementations that showcase debugging capabilities across JavaScript, Python, TypeScript, Go, Java, and Rust environments.

## Key Components and Integration

### Core Demonstration Systems
- **`agent_demo.py`**: Autonomous LLM agent that executes predefined debugging workflows, demonstrating systematic debugging practices through MCP tool calls
- **`asciinema_demo/`**: Complete terminal-based debugging demonstration combining a buggy event processor with Rich TUI visualization for creating compelling documentation and marketing materials
- **`python_simple_swap/`**: Educational debugging tutorial showing remote debugging of intentionally buggy Python code through complete MCP client-server workflow

### Interactive Visualization Infrastructure
- **`visualizer/`**: Professional terminal UI system that transforms MCP server logs into real-time debugging visualizations with syntax highlighting, breakpoint tracking, and tool activity monitoring
- **`demo/`**: Recording and documentation generation system for creating professional terminal recordings, SVG animations, and GIF demonstrations

### Multi-Language Test Suites
- **Language-specific directories** (`javascript/`, `python/`, `go/`, `java/`, `rust/`): Comprehensive test scripts designed for debugger validation across different runtime environments
- **`debugging/`**: Cross-platform debugging validation scripts with SSE integration testing and runtime-specific debugging scenarios

## Public API Surface

### Primary Entry Points
- **Demo Execution**: 
  - `agent_demo.py` - Autonomous debugging agent demonstration
  - `asciinema_demo/run_rich_demo.py` - Interactive terminal debugging demo
  - `demo/mcp_debugger_demo.py` - Theatrical debugging simulation
- **Visualization**: `visualizer/live_visualizer.py` - Real-time debugging session visualization
- **Educational Workflows**: `python_simple_swap/debug_swap_demo.py` - Complete debugging tutorial

### Testing and Validation APIs
Each language directory provides standardized test scenarios:
- **Basic Operations**: Variable manipulation, arithmetic, simple control flow
- **Advanced Patterns**: Recursion, async operations, complex data structures
- **Debugging Features**: Breakpoint placement, variable inspection, stack trace validation
- **Runtime-Specific**: Language-specific debugging scenarios and edge cases

## Internal Organization and Data Flow

### Demonstration Architecture
The examples follow a layered approach progressing from simple to sophisticated:

1. **Foundation Layer**: Basic test scripts (`pause_test.py`, `test_evaluate_expression.py`) for fundamental debugging operations
2. **Language Integration**: Comprehensive test suites validating debugger compatibility across multiple runtimes
3. **Workflow Demonstration**: Complete debugging scenarios showing real-world usage patterns
4. **Visualization Layer**: Professional UI systems for documentation and user experience demonstration

### Common Patterns and Conventions

### Educational Design Philosophy
- **Progressive Complexity**: Examples range from simple variable swaps to complex concurrent programming patterns
- **Debugging-First Architecture**: All code prioritizes debugging visibility with strategic breakpoint placement and clear state transitions
- **Self-Contained Modules**: Each example runs independently while contributing to comprehensive validation coverage
- **Cross-Language Consistency**: Similar computational patterns implemented across languages for consistent debugging validation

### Integration Workflows
- **MCP Protocol Compliance**: All demonstrations use standard JSON-RPC 2.0 protocol for MCP server communication
- **Session Management**: Robust debug session lifecycle handling with proper cleanup and resource management
- **Real-Time Visualization**: Event-driven architecture connecting log monitoring to interactive terminal interfaces
- **Documentation Generation**: Automated recording and conversion pipelines for creating professional demo materials

### Resource Management
- **Error Handling**: Comprehensive validation and recovery mechanisms throughout all demonstration systems
- **Process Lifecycle**: Proper management of MCP server processes, debug sessions, and visualization components
- **File System Integration**: Robust path handling, file monitoring, and cross-platform compatibility

## Role in Larger System

This directory serves as the primary showcase and validation suite for MCP debugger capabilities, providing developers, educators, and potential users with complete working examples of debugging workflows. It bridges the gap between theoretical debugger functionality and practical implementation while serving as a comprehensive testing ground for debugger development and a rich source of documentation materials.

The examples demonstrate the full spectrum of MCP debugger use cases from simple script debugging to sophisticated multi-language development workflows, making this directory essential for understanding, validating, and promoting MCP debugger adoption across diverse development environments.