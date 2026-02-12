# src\cli\commands/
@generated: 2026-02-12T21:05:43Z

## Purpose
The `cli/commands` directory contains command handler implementations for a debugging MCP (Model Context Protocol) adapter CLI tool. This module provides the actual business logic for CLI commands that analyze and inspect software artifacts for debugging compatibility.

## Core Architecture

### Command Handler Pattern
The directory follows a consistent command handler pattern where each file implements a specific CLI command's functionality. Commands are designed to be invoked by a CLI framework with standardized input/output interfaces.

### Lazy Loading Strategy
Commands implement lazy loading for heavy dependencies to improve startup performance:
- External adapter modules are loaded on-demand with graceful error handling
- Missing build artifacts trigger helpful error messages with remediation steps

### Output Management
All commands support dual output modes:
- **JSON Mode**: Machine-readable structured output for programmatic consumption
- **Human-readable Mode**: Formatted text output with detailed analysis and recommendations

## Public API Surface

### Main Entry Points
- `handleCheckRustBinaryCommand()`: Analyzes Rust executable binaries for debugging compatibility
  - Input: Binary file path and optional configuration
  - Output: Toolchain details, debug format info, and runtime dependencies

### Configuration Interface
- Command options follow a consistent pattern with optional JSON output flags
- Standardized error handling and user feedback mechanisms

## Internal Organization

### Data Flow
1. **Input Validation**: File existence and accessibility checks
2. **Analysis**: Delegate to specialized adapter modules for format-specific inspection
3. **Processing**: Extract and categorize relevant debugging information
4. **Output Formatting**: Generate appropriate human-readable or JSON responses
5. **Error Handling**: Provide actionable error messages and remediation guidance

### Key Components
- **Binary Analysis**: Integration with `@debugmcp/adapter-rust` for executable inspection
- **Output Formatters**: Specialized functions for presenting analysis results
- **Dependency Management**: Runtime dependency filtering and categorization
- **Toolchain Detection**: Identification of build toolchain characteristics

## Important Patterns

### Error Handling Strategy
- Graceful degradation when optional information is unavailable
- User-friendly error messages with specific remediation steps
- Build-time dependency validation with helpful troubleshooting

### Extensibility Design
- Modular command structure supports easy addition of new analysis commands
- Consistent interfaces enable uniform CLI behavior across different analysis types
- Adapter pattern allows plugging in different analysis backends

### Output Consistency
- Standardized JSON schemas for machine consumption
- Consistent human-readable formatting with actionable insights
- Runtime dependency filtering using configurable patterns

This directory serves as the primary command execution layer, bridging CLI input parsing with specialized analysis adapters while maintaining consistent user experience across different debugging analysis workflows.