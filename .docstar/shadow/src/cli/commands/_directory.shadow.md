# src\cli\commands/
@children-hash: 5c75b0c351598009
@generated: 2026-02-15T09:01:25Z

## Overall Purpose and Responsibility

The `src/cli/commands` directory contains CLI command handlers for a debugging MCP (Model Context Protocol) adapter system. This module provides command-line utilities for analyzing and debugging Rust executables, focusing on extracting toolchain information, debugging compatibility, and runtime dependencies from binary files.

## Key Components and Architecture

### Command Handler Structure
The directory follows a modular command pattern where each file implements a specific CLI command:

- **check-rust-binary.ts**: Primary command handler for Rust binary analysis, providing both programmatic and human-readable output of binary debugging information

### Lazy Loading Pattern
Commands implement lazy module loading to handle optional dependencies gracefully:
- Runtime loading of `@debugmcp/adapter-rust` with informative error messages when builds are missing
- Cached function references to avoid repeated module resolution
- User-friendly build instructions when dependencies are unavailable

### Output Management
Consistent output formatting across commands:
- Support for both JSON and human-readable output formats
- Structured console utilities (`writeOutput`, `writeError`) with proper newline handling
- Detailed formatting functions that provide actionable insights and recommendations

## Public API Surface

### Main Entry Points
- `handleCheckRustBinaryCommand(binaryPath: string, options?: CheckRustBinaryOptions)`: Analyzes Rust binaries and outputs debugging compatibility information

### Configuration Interfaces
- `CheckRustBinaryOptions`: Command configuration with JSON output flag support

### Output Formats
- Human-readable summaries with toolchain recommendations and debugging compatibility assessments
- JSON output for programmatic consumption
- Error reporting with helpful troubleshooting guidance

## Internal Organization and Data Flow

1. **Input Validation**: File existence and accessibility checks
2. **Lazy Module Loading**: Runtime loading of analysis dependencies with error handling
3. **Binary Analysis**: Delegation to specialized adapter modules for format detection and information extraction
4. **Output Formatting**: Conditional formatting based on output preferences (JSON vs. human-readable)
5. **Result Presentation**: Console output with appropriate error handling and user guidance

## Important Patterns and Conventions

### Error Handling Strategy
- Graceful degradation when optional modules are missing
- Informative error messages with actionable remediation steps
- Build instruction guidance for missing dependencies

### Toolchain-Aware Processing
- Detection and handling of different Rust toolchain types (GNU/MSVC)
- Toolchain-specific recommendations and compatibility assessments
- Runtime dependency filtering with regex patterns

### Extensible Command Structure
- Modular command organization allowing easy addition of new CLI commands
- Consistent interfaces and patterns for command implementation
- Shared utilities for common operations (file validation, output formatting)

This directory serves as the CLI interface layer for the debugging MCP adapter, providing user-friendly access to complex binary analysis functionality while maintaining clean separation of concerns between command handling, analysis logic, and output presentation.