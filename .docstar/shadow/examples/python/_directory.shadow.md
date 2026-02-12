# examples\python/
@generated: 2026-02-12T21:05:43Z

## Overview
The `examples/python` directory contains a collection of Python test scripts specifically designed for MCP (Message Control Protocol) debugger testing and demonstration. This module serves as a debugging sandbox, providing various Python programming patterns and scenarios to exercise debugging capabilities.

## Primary Purpose
- **Debugger Testing**: Comprehensive test cases for validating MCP Server debugging functionality
- **Educational Examples**: Simple, well-structured code snippets for learning debugging techniques
- **Development Validation**: Controlled test environments for debugging tool development and verification

## Key Components

### Core Test Scripts
- **`simple_test.py`**: Minimal debugging target with basic variable swap operations and clear breakpoint locations
- **`test_python_debug.py`**: Focused mathematical operations (factorial, list processing) for step-through debugging
- **`python_test_comprehensive.py`**: Extensive debugging scenarios covering multiple language features and control flows
- **`fibonacci.py`**: Specialized debugging exercise with intentional bugs and algorithmic comparisons

### Common Patterns
All scripts follow consistent architectural patterns:
- **Self-contained execution**: No external dependencies, using only Python built-ins
- **Clear entry points**: Standard `if __name__ == "__main__"` pattern
- **Breakpoint-friendly design**: Strategic comment placement and logical pause points
- **Observable state changes**: Variable mutations and print statements for debugging validation

## Public API Surface
Each script functions as an independent executable:
- **Direct execution**: `python <script_name>.py` runs complete test scenarios
- **Function-level testing**: Individual functions can be imported and tested in isolation
- **Debugging targets**: Well-defined breakpoint locations and state inspection opportunities

## Internal Organization
The directory follows a progression of complexity:
1. **Simple scenarios** (`simple_test.py`) - Basic variable operations
2. **Algorithm focus** (`test_python_debug.py`) - Mathematical functions and data processing  
3. **Comprehensive coverage** (`python_test_comprehensive.py`) - Multiple language features
4. **Bug injection** (`fibonacci.py`) - Intentional errors for debugging practice

## Data Flow Patterns
- **Procedural execution**: Linear function calls with clear input/output relationships
- **Test orchestration**: Main functions coordinate multiple test scenarios
- **Result validation**: Print statements and return values enable debugging verification
- **State inspection points**: Strategic variable assignments for breakpoint placement

## Usage Context
This module integrates with MCP debugging infrastructure by providing:
- **Reproducible test cases** for debugger validation
- **Educational examples** for debugging technique demonstration  
- **Development targets** for testing new debugging features
- **Regression testing** through predictable, deterministic execution paths

The scripts collectively ensure comprehensive coverage of Python debugging scenarios while maintaining simplicity and educational value.