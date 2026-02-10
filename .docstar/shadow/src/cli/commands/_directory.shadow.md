# src/cli/commands/
@generated: 2026-02-10T01:19:35Z

## Purpose
This directory contains CLI command handlers for the debugging MCP adapter system. It provides command-line interfaces for analyzing and debugging various binary formats and development artifacts.

## Core Architecture

### Command Pattern Implementation
The directory implements a modular command pattern where each file represents a distinct CLI command handler. Commands are designed to be:
- Self-contained with their own option interfaces
- Lazily loaded for performance optimization
- Consistent in output formatting (JSON vs human-readable)

### Key Components

#### Binary Analysis Commands
- **check-rust-binary.ts**: Analyzes Rust executables for debugging compatibility, extracting toolchain information, debug formats, and runtime dependencies

### Common Patterns

#### Lazy Module Loading
Commands implement lazy loading of heavyweight analysis modules to improve CLI startup performance. Error handling includes helpful build instructions when dependencies are missing.

#### Output Formatting
Standardized dual-format output system:
- Human-readable format with detailed summaries and recommendations
- JSON format for programmatic consumption
- Consistent error handling and messaging

#### File System Integration
Commands validate input files for existence and accessibility before processing, with clear error messages for common failure scenarios.

## Public API Surface

### Main Entry Points
- `handleCheckRustBinaryCommand(binaryPath: string, options?: CheckRustBinaryOptions)`: Analyzes Rust binaries for debugging information

### Option Interfaces
- Command-specific option types (e.g., `CheckRustBinaryOptions`) with consistent patterns for output formatting preferences

## Internal Organization

### Module Dependencies
Commands depend on specialized adapter modules (e.g., `@debugmcp/adapter-rust`) for core analysis functionality, while maintaining CLI-specific concerns like formatting and user interaction.

### Data Flow
1. Input validation and file system checks
2. Lazy loading of analysis modules
3. Binary/artifact analysis
4. Output formatting based on user preferences
5. Results output to stdout/stderr

## Important Conventions

### Error Handling
- User-friendly error messages with actionable guidance
- Graceful degradation when optional information is unavailable
- Clear distinction between system errors and analysis limitations

### Output Standards
- Consistent JSON schema for programmatic usage
- Human-readable output with structured sections
- Toolchain-specific recommendations and compatibility guidance

This directory serves as the command-line interface layer for the debugging MCP system, abstracting complex analysis operations into user-friendly CLI commands with consistent behavior and output formatting.