# examples/
@generated: 2026-02-12T21:01:43Z

## Overall Purpose and Responsibility

The `examples` directory serves as a comprehensive demonstration and testing suite for the MCP (Model Context Protocol) debugger system. It provides working implementations, educational resources, and validation tools that showcase debugging capabilities across multiple programming languages (Python, JavaScript/TypeScript, Go, Rust) while demonstrating both automated and interactive debugging workflows.

## Key Components and Integration

### Language-Specific Test Suites
- **python/**: Complete Python debugging scenarios from simple variable swaps to complex algorithms, including the flagship `python_simple_swap` demonstration
- **javascript/**: Comprehensive JavaScript/TypeScript test files covering recursive functions, async operations, and MCP integration patterns
- **go/**: Educational Go examples progressing from basic syntax through advanced concurrency patterns
- **rust/**: Rust learning modules demonstrating both fundamental concepts and async programming with Tokio

### Demonstration and Visualization Infrastructure
- **visualizer/**: Complete TUI (Terminal User Interface) system for real-time MCP debugging session visualization with Rich-based panels, log monitoring, and interactive controls
- **asciinema_demo/**: Interactive terminal demonstrations combining buggy target applications with rich UI for end-to-end debugging workflow showcases
- **demo/**: Documentation asset generation pipeline creating terminal recordings and distributable demo materials

### Integration and Orchestration Tools
- **debugging/**: Integration test infrastructure validating MCP protocol timing, SSE communication, and cross-language debugging workflows
- **agent_demo.py**: Autonomous LLM agent simulation demonstrating systematic debugging workflows through MCP tool calls
- **pause_test.py** & **test_evaluate_expression.py**: Focused testing utilities for breakpoint placement and expression evaluation scenarios

## Public API Surface

### Primary Entry Points
- **Interactive Demonstrations**: `visualizer/debug_visualizer.py`, `asciinema_demo/run_rich_demo.py` for live debugging UI
- **Autonomous Workflows**: `agent_demo.py` for simulated AI-driven debugging sessions
- **Language-Specific Testing**: Each language directory provides standalone test scripts and comprehensive debugging scenarios
- **Asset Generation**: `demo/record_demo.sh` and visualization recording tools for documentation creation

### Key Integration Points
- **MCP Protocol**: All examples integrate with MCP debug servers using standardized tool calls (`create_debug_session`, `set_breakpoint`, `get_stack_trace`)
- **Cross-Language Support**: Consistent debugging patterns across Python, JavaScript, Go, and Rust implementations
- **Educational Progression**: From basic syntax examples to advanced async programming and debugging workflows

## Internal Organization and Data Flow

### Workflow Orchestration
1. **Target Application Execution**: Language-specific test scripts provide debugging targets with intentional bugs and strategic breakpoint locations
2. **MCP Server Communication**: Debug clients communicate via JSON-RPC 2.0 protocol with session management and state tracking
3. **Visualization and Monitoring**: Real-time UI components consume debug events and provide interactive debugging experiences
4. **Documentation Generation**: Recording and conversion pipeline transforms live sessions into distributable demo assets

### Cross-Component Integration
- **Shared Testing Patterns**: Common debugging scenarios (variable inspection, stack traces, breakpoint management) implemented consistently across languages
- **Protocol Standardization**: Unified MCP tool usage patterns enabling consistent debugging workflows regardless of target language
- **Educational Continuity**: Progressive complexity from simple variable operations through advanced concurrent programming patterns

## Important Patterns and Conventions

### Educational Design Philosophy
- **Self-Contained Examples**: Each directory and script is independently executable with minimal setup requirements
- **Progressive Complexity**: Clear learning progression from basic concepts to advanced debugging scenarios
- **Intentional Bugs**: Strategic introduction of common programming errors for realistic debugging practice

### Production-Ready Patterns
- **Resource Management**: Comprehensive cleanup logic and session lifecycle management
- **Error Resilience**: Robust error handling with graceful degradation across all integration points
- **Cross-Platform Compatibility**: Path normalization and encoding fallbacks ensuring consistent behavior across operating systems

### Demonstration Excellence
- **Visual Appeal**: Rich terminal interfaces with syntax highlighting, real-time updates, and professional presentation quality
- **Reproducible Workflows**: Deterministic test scenarios enabling consistent demo experiences and automated validation

This directory collectively provides a complete ecosystem for MCP debugger development, testing, education, and demonstration, serving as both a validation suite for debugging functionality and a comprehensive learning resource for developers working with MCP debugging tools.