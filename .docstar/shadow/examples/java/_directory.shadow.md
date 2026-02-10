# examples/java/
@generated: 2026-02-09T18:16:02Z

## Java Examples Directory

**Overall Purpose**: Educational code examples demonstrating Java debugging scenarios and debugger attachment workflows. This directory provides practical test programs for learning and validating debugging capabilities in Java development environments.

**Key Components**:

### AttachTestProgram.java
- **Purpose**: Long-running test process designed for debugger attachment demonstrations
- **Behavior**: Infinite counter loop with predictable 1-second intervals
- **Features**: Clear breakpoint targets, observable state changes, graceful interruption handling
- **Use Case**: IDE debugging tutorials, attach-to-process workflow training

### TestJavaDebug.java
- **Purpose**: Comprehensive debugging practice script with multiple algorithmic scenarios
- **Operations**: Factorial computation, array processing, data transformation
- **Features**: Static utility methods, predictable execution flow, formatted output
- **Use Case**: Step-through debugging exercises, breakpoint placement practice

**Public API Surface**:
- `AttachTestProgram.main(String[] args)`: Entry point for attachment testing
- `TestJavaDebug.main(String[] args)`: Entry point for debugging exercises
- `TestJavaDebug.factorial(int n)`: Recursive factorial computation
- `TestJavaDebug.sumArray(int[] numbers)`: Array summation utility
- `TestJavaDebug.processData(int[] data)`: Array transformation utility

**Internal Organization**:
Both programs follow simple, linear execution patterns optimized for debugging visibility:
- Clear method boundaries for step-over/step-into practice
- Predictable timing and state changes
- Observable intermediate results through console output
- Strategic locations for breakpoint placement

**Data Flow**:
- **AttachTestProgram**: Counter state → Console output → Sleep → Repeat
- **TestJavaDebug**: Input data → Method processing → Formatted output → Final computation

**Important Patterns**:
- **Zero external dependencies**: Both programs use only standard Java runtime
- **Static method design**: No object instantiation required, simplified debugging
- **Explicit timing controls**: Predictable execution speed for debugging practice
- **Clear demarcation points**: Comments and structure optimized for breakpoint placement
- **Error-free execution**: Designed to complete successfully under normal conditions

**Usage Context**: Intended for debugging education, IDE testing, and development environment validation. Programs can be run independently or used together to demonstrate different debugging scenarios (attach vs. launch debugging).