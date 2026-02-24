# examples/
@children-hash: 60392fae0ac30dd2
@generated: 2026-02-24T01:55:43Z

## Overall Purpose and Responsibility

The `examples` directory serves as a comprehensive demonstration and testing suite for the MCP (Model Context Protocol) debugging system. It provides educational examples, integration tests, debugging scenarios, and visualization tools across multiple programming languages to validate and showcase debugging capabilities. This module acts as both a quality assurance framework and a user education resource for MCP debugging functionality.

## Key Components and Integration

### Demonstration Infrastructure
- **agent_demo.py**: Autonomous LLM agent demonstrating end-to-end debugging workflows with predefined action sequences
- **demo/**: Theatrical debugging simulation with automated recording infrastructure for creating documentation materials
- **asciinema_demo/**: Rich terminal UI demonstration combining buggy code with interactive debugger frontend for live presentations

### Language-Specific Test Suites
- **python/**: Comprehensive Python debugging scenarios including algorithms, data structures, and intentional bug injection
- **javascript/**: JavaScript and TypeScript debugging validation with source maps, async operations, and complex data structures
- **go/**: Go language examples progressing from basic syntax to advanced concurrency patterns
- **rust/**: Educational Rust programming examples covering synchronous and asynchronous patterns

### Specialized Testing Scenarios
- **debugging/**: Cross-language integration tests validating MCP debugging functionality and timing-sensitive operations
- **python_simple_swap/**: Complete MCP debugging workflow demonstration with deliberate variable swap bug
- **visualizer/**: Terminal User Interface (TUI) for real-time debugging session visualization with log monitoring

### Utility Components
- **pause_test.py** and **test_evaluate_expression.py**: Standalone testing utilities for manual debugging and expression evaluation validation

## Public API Surface and Entry Points

### Primary Demonstration Interfaces
- **Agent Simulation**: `agent_demo.py` - Autonomous debugging agent with HTTP MCP communication
- **Interactive Demos**: `asciinema_demo/run_rich_demo.py` - Rich UI debugging demonstration
- **Recording Infrastructure**: `demo/record_demo.sh` - Automated demo recording and conversion pipeline
- **Real-time Visualization**: `visualizer/live_visualizer.py` - TUI for debugging session monitoring

### Language Test Execution
- **Python**: Multiple standalone test scripts (`python/*.py`) for various debugging scenarios
- **JavaScript**: Comprehensive test suite (`javascript/*.js`) including TypeScript integration
- **Go**: Educational examples (`go/*/main.go`) with progressive complexity
- **Rust**: Binary applications (`rust/*/src/main.rs`) demonstrating async and sync patterns

### Integration Testing
- **Cross-language validation**: `debugging/test-sse-js-debug-fix.js` for critical integration testing
- **MCP workflow testing**: `python_simple_swap/debug_swap_demo.py` for complete debugging lifecycle

## Internal Organization and Data Flow

### Progressive Learning Architecture
The directory follows an educational progression from simple examples to complex scenarios:
1. **Basic Examples**: Simple variable operations and arithmetic (`pause_test.py`, language-specific simple tests)
2. **Comprehensive Scenarios**: Full debugging workflows with multiple languages and features
3. **Advanced Integration**: Real-time visualization, automated agents, and production-ready demonstrations

### Communication Patterns
- **MCP Protocol**: JSON-RPC 2.0 communication with session management and tool invocation
- **Session Management**: Dual session tracking (MCP HTTP + debug session) across multiple implementations
- **Real-time Updates**: Event-driven UI updates and log monitoring for live debugging visualization

### Testing and Validation Flow
1. **Unit Testing**: Individual language examples validate basic debugging operations
2. **Integration Testing**: Cross-component tests ensure MCP protocol compliance
3. **End-to-End Validation**: Complete workflows from session creation through cleanup
4. **Documentation Generation**: Automated recording and conversion for user-facing materials

## Important Patterns and Conventions

### Debugging-Optimized Design
- Strategic breakpoint placement with explicit comment markers
- Comprehensive console logging for trace visibility
- Self-contained examples requiring minimal external dependencies
- Predictable execution flows suitable for step-through debugging

### Educational Structure
- Progressive complexity from basic syntax to advanced patterns
- Multiple implementation approaches for comparative learning
- Intentional bug injection for realistic debugging practice
- Comprehensive language feature coverage

### Production Readiness
- Robust error handling with graceful degradation
- Resource cleanup guarantees across all scenarios
- Cross-platform compatibility and path normalization
- Performance optimizations for real-time visualization

### Protocol Compliance
- Standardized JSON-RPC 2.0 communication patterns
- Consistent session lifecycle management
- Error propagation with context preservation
- Tool parameter validation and state tracking

This directory serves as the definitive reference for MCP debugging capabilities, providing everything from basic debugging scenarios to sophisticated real-time visualization tools, ensuring comprehensive validation and education for debugging functionality across multiple programming languages.