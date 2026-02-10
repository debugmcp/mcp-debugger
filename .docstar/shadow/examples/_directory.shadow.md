# examples/
@generated: 2026-02-10T01:20:27Z

## Overall Purpose and Responsibility

The `examples` directory serves as a **comprehensive demonstration and testing ecosystem** for the MCP (Model Context Protocol) debugger system. It provides educational examples, integration tests, validation scenarios, and interactive demonstrations across multiple programming languages and debugging workflows. The directory functions as both a learning resource for MCP debugging concepts and a comprehensive test suite for validating debugger functionality.

## Key Components and Integration

### Multi-Language Debugging Target Scripts
- **Python examples** (`python/`, `python_simple_swap/`): Complete progression from simple variable swaps to comprehensive debugging scenarios with recursive algorithms and intentional bugs
- **JavaScript/TypeScript examples** (`javascript/`): Full-featured test suite including TypeScript source map debugging, async patterns, and comprehensive language feature coverage
- **Java examples** (`java/`): Educational debugging targets with infinite loops for attachment testing and mathematical utilities for algorithm debugging
- **Go examples** (`go/`): Progressive complexity from basic syntax to advanced concurrency patterns using goroutines and channels
- **Rust examples** (`rust/`): Foundation-to-advanced progression covering core language concepts and async/Tokio programming patterns

### Interactive Demonstration Systems
- **Rich Terminal UI Visualizer** (`visualizer/`): Real-time TUI system for visualizing MCP debugging sessions with code highlighting, breakpoint tracking, and variable inspection
- **Asciinema Demo Environment** (`asciinema_demo/`): Complete recording infrastructure with buggy target scripts and Rich-based demo controllers for documentation
- **Agent Simulation** (`agent_demo.py`): Autonomous LLM agent demonstration executing predefined debugging workflows through MCP server integration
- **Theatrical Demo** (`demo/`): AI-powered debugging simulation with color-coded output and educational narrative progression

### Integration Test Infrastructure
- **Debug Session Testing** (`debugging/`): Comprehensive validation of MCP debugging across languages with timing bug regression tests and SSE transport validation
- **Expression Evaluation Testing** (`test_evaluate_expression.py`, `pause_test.py`): Controlled environments for testing debugger expression evaluation and breakpoint functionality
- **Recording and Documentation** (`demo/record_demo.sh`, `visualizer/record_session.py`): Automated pipeline for creating professional demo recordings and documentation assets

## Public API Surface and Entry Points

### Primary Demonstration Interfaces
- **`agent_demo.py`**: Autonomous debugging agent demonstration with predefined workflow execution
- **`visualizer/live_visualizer.py`**: Real-time MCP session visualization with terminal UI
- **`asciinema_demo/run_rich_demo.py`**: Interactive demo controller with split-pane interface
- **`demo/mcp_debugger_demo.py`**: Theatrical debugging simulation with educational narrative
- **`python_simple_swap/debug_swap_demo.py`**: Complete MCP debugging workflow demonstration

### Language-Specific Test Targets
Each language directory provides graduated complexity levels:
- **Entry-level**: Basic syntax and simple operations for initial debugger testing
- **Intermediate**: Mathematical algorithms and data processing for step-through debugging  
- **Advanced**: Complex patterns like recursion, concurrency, async operations, and intentional bugs

### Recording and Documentation Tools
- **Demo recording**: `demo/record_demo.sh`, `visualizer/record_session.py`
- **Media conversion**: `visualizer/convert_to_gif.py` and optimization utilities
- **Documentation integration**: Complete pipeline from demonstration to shareable assets

## Internal Organization and Data Flow

### Debugging Workflow Architecture
The directory implements a **layered demonstration approach**:

1. **Target Layer**: Language-specific scripts providing debugging scenarios
2. **Client Layer**: MCP client implementations demonstrating protocol usage (`agent_demo.py`, debug demos)
3. **Visualization Layer**: Rich TUI systems for real-time debugging session visualization
4. **Recording Layer**: Documentation and demo recording infrastructure
5. **Integration Layer**: End-to-end testing and validation systems

### Component Interaction Patterns
- **MCP Protocol Communication**: JSON-RPC 2.0 client implementations with session management
- **Real-time Event Processing**: Log monitoring and state synchronization for live visualization
- **Educational Progression**: Graduated complexity across languages and scenarios
- **Documentation Pipeline**: From live demonstration through recording to optimized media assets

## Important Patterns and Conventions

### Debugging-Optimized Design
- **Strategic Breakpoint Placement**: All target scripts include explicit breakpoint location markers
- **Predictable Execution Flow**: Deterministic behavior for consistent debugging experiences
- **Extensive Logging**: Console output and state visibility optimized for educational purposes
- **Self-Contained Examples**: Minimal external dependencies for reliable execution

### Integration Testing Strategy
- **Multi-Language Coverage**: Comprehensive validation across Python, JavaScript/TypeScript, Java, Go, and Rust
- **Transport Protocol Testing**: SSE and HTTP-based MCP communication validation
- **Session Lifecycle Testing**: Complete debugging session management with proper cleanup
- **Timing and Synchronization**: Regression tests for session readiness and event handling

### Educational Architecture
- **Progressive Complexity**: Examples build from basic concepts to advanced debugging scenarios
- **Cross-Language Consistency**: Similar debugging patterns implemented across different languages
- **Visual Learning**: Rich terminal interfaces and recorded demonstrations for multiple learning styles
- **Practical Application**: Real debugging scenarios with intentional bugs and problem-solving workflows

This directory represents the definitive reference implementation and demonstration suite for MCP debugging, providing both educational resources for learning debugging concepts and comprehensive validation tools for MCP debugger development.