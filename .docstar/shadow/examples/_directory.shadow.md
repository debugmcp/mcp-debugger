# examples/
@children-hash: d885a613f9405606
@generated: 2026-02-15T09:02:08Z

## Overall Purpose and Responsibility

The `examples` directory serves as a comprehensive demonstration and testing suite for MCP (Model Context Protocol) debugging capabilities across multiple programming languages and use cases. It provides both educational resources for developers learning debugging techniques and validation infrastructure for ensuring MCP debugging tools work correctly across different scenarios and environments.

## Key Components and How They Relate

### Core Demonstration Scripts
- **agent_demo.py**: Autonomous LLM agent that executes complete debugging workflows, demonstrating MCP server integration patterns and session management
- **pause_test.py** & **test_evaluate_expression.py**: Simple Python debugging targets with strategic breakpoints for testing variable inspection and expression evaluation

### Multi-Language Test Suites
- **python/**: Comprehensive Python debugging scenarios from simple variable swaps to complex algorithmic testing (fibonacci, factorial, data processing)
- **javascript/**: Complete JavaScript/TypeScript debugging validation including recursive functions, async operations, and source map support
- **go/**: Educational Go examples progressing from basic syntax to advanced concurrency patterns with goroutines
- **rust/**: Foundational and advanced Rust examples covering standard library usage and async programming with Tokio

### Specialized Demonstration Modules
- **python_simple_swap/**: End-to-end MCP debugging workflow with intentional bugs for educational purposes
- **debugging/**: Integration testing framework that validates SSE timing fixes and cross-language debugging functionality
- **asciinema_demo/**: Rich terminal UI demonstration combining buggy code with interactive debugger frontend for recording purposes

### Visualization and Documentation Tools
- **visualizer/**: Complete TUI application for real-time debugging session visualization with log monitoring, syntax highlighting, and state tracking
- **demo/**: Automated recording infrastructure that creates visual documentation materials (SVG animations, GIFs) for README integration

## Public API Surface

### Primary Entry Points
- **Direct Execution**: Most scripts can be run independently via `python filename.py`, `node filename.js`, `go run filename.go`, or `cargo run`
- **Demo Orchestration**: `demo_runner.py`, `run_rich_demo.py` for complete demonstration workflows
- **Agent Simulation**: `agent_demo.py` for autonomous debugging workflow demonstration
- **Recording Infrastructure**: `record_demo.sh` and recording tools for documentation generation

### Integration APIs
- **MCP Client Patterns**: JSON-RPC 2.0 communication examples with session management and tool invocation
- **Debugging Workflows**: Breakpoint management, variable inspection, stack trace analysis, and execution control
- **Multi-Language Support**: Consistent debugging patterns across Python, JavaScript, Go, and Rust environments

## Internal Organization and Data Flow

### Educational Progression
The directory follows a structured learning path:
1. **Simple Examples**: Basic debugging scenarios in individual language directories
2. **Comprehensive Testing**: Full-featured test suites exercising all debugging capabilities
3. **Advanced Integration**: Complete workflows combining multiple tools and visualization
4. **Documentation Generation**: Automated recording and conversion for user-facing materials

### Communication Patterns
- **MCP Protocol**: JSON-RPC 2.0 over HTTP with session management and tool-based APIs
- **Real-time Monitoring**: Log file watching with event parsing for live visualization
- **Process Orchestration**: Subprocess management for server lifecycle and demo coordination

### Validation Strategy
- **Cross-Language Coverage**: Ensures debugging works consistently across programming languages
- **Scenario Diversity**: From simple breakpoints to complex concurrent programming patterns
- **Integration Testing**: End-to-end workflow validation including timing-sensitive operations

## Important Patterns and Conventions

### Debugging-Optimized Design
- Strategic breakpoint placement with explicit comments indicating intended debug locations
- Extensive logging and console output for trace visibility
- Self-contained examples with minimal external dependencies
- Predictable execution flows suitable for step-through debugging

### MCP Integration Standards
- Consistent session management with proper cleanup in finally blocks
- Standardized error handling with server response validation
- UUID-based request tracking for JSON-RPC communication
- HTTP session persistence for MCP server state management

### Educational Structure
- Progressive complexity from basic syntax to advanced programming patterns
- Intentional bug injection for realistic debugging scenarios
- Comprehensive documentation through both code comments and visual demonstrations
- Multi-modal learning support (terminal output, rich UI, recorded demos)

### Resource Management
- Graceful shutdown patterns with signal handling
- Proper subprocess lifecycle management
- File encoding fallbacks for cross-platform compatibility
- Memory-bounded data structures for long-running visualizations

This directory serves as both a comprehensive testing framework for MCP debugging infrastructure and an educational resource for developers learning debugging techniques across multiple programming languages and environments.