# src/cli/commands/
@generated: 2026-02-10T21:26:16Z

## Purpose
This directory contains CLI command handlers for a debugging MCP (Model Context Protocol) adapter system. It provides user-facing command implementations that analyze and inspect debugging-related information for various toolchains and binary formats.

## Core Architecture

### Command Structure
The directory follows a command-per-file pattern where each TypeScript file implements a specific CLI command handler. Commands are designed to be invoked from a parent CLI system and provide both programmatic and human-readable output options.

### Key Components
- **check-rust-binary.ts**: Analyzes Rust executable binaries to extract debugging compatibility information, toolchain details, and runtime dependencies

### Integration Patterns
- **Lazy Module Loading**: Commands use deferred loading of adapter modules (e.g., `@debugmcp/adapter-rust`) with user-friendly error messaging when dependencies are missing
- **Dual Output Modes**: All commands support both JSON output for programmatic consumption and formatted human-readable output for direct user interaction
- **Error Handling**: Consistent error reporting with actionable guidance (build instructions, troubleshooting steps)

## Public API Surface

### Main Entry Points
- `handleCheckRustBinaryCommand(binaryPath: string, options?: CheckRustBinaryOptions)`: Primary handler for Rust binary analysis
  - Validates binary accessibility
  - Extracts debugging metadata and toolchain information
  - Outputs compatibility assessments and recommendations

### Configuration Interface
- `CheckRustBinaryOptions`: Standard configuration object supporting JSON output mode selection
- Commands accept target paths/identifiers plus optional configuration objects
- All handlers return `Promise<void>` but output results via stdout/stderr

## Internal Organization

### Data Flow
1. **Validation**: Input paths/targets are validated for existence and accessibility
2. **Analysis**: Adapter modules are lazily loaded and invoked to extract metadata
3. **Processing**: Raw analysis results are processed and enhanced with recommendations
4. **Output**: Results are formatted according to output mode and written to console

### Output Formatting
- **Human-readable**: Detailed summaries with sections for different aspects (toolchain, debug info, dependencies, recommendations)
- **JSON**: Structured data suitable for programmatic consumption
- **Utilities**: Shared formatting functions for consistent output styling and error handling

## Key Patterns
- **Defensive Programming**: Extensive validation with graceful degradation when information is unavailable
- **Extensible Design**: Command structure supports easy addition of new toolchain analyzers
- **User Experience Focus**: Rich error messages, clear recommendations, and contextual help for missing dependencies
- **Separation of Concerns**: Analysis logic delegated to specialized adapter modules, commands focus on I/O and formatting