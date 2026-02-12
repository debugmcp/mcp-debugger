# src/cli/commands/
@generated: 2026-02-11T23:47:36Z

## Purpose
The `src/cli/commands` directory contains CLI command handlers for the debugging MCP (Model Control Protocol) adapter system. This module serves as the command-line interface layer, providing executable commands that analyze and report on debugging-related information for various binary formats.

## Core Components

### Rust Binary Analysis Command
- **check-rust-binary.ts**: Primary command handler for analyzing Rust executable binaries
  - Extracts debugging compatibility information (debug formats, PDB presence)
  - Identifies toolchain details (GNU vs MSVC) and runtime dependencies
  - Provides debugging setup recommendations and compatibility assessments

## Public API Surface

### Main Entry Points
- `handleCheckRustBinaryCommand(binaryPath: string, options?: CheckRustBinaryOptions)`: Analyzes Rust binaries and outputs comprehensive debugging information
- `CheckRustBinaryOptions`: Configuration interface supporting JSON output format selection

### Output Formats
- Human-readable formatted reports with toolchain recommendations
- JSON output for programmatic consumption
- Structured error messaging with helpful build instructions

## Internal Organization

### Architecture Patterns
- **Lazy Module Loading**: Commands dynamically load analysis adapters (`@debugmcp/adapter-rust`) with graceful error handling for missing dependencies
- **Dual Output Modes**: All commands support both human-readable and JSON output formats for different consumption scenarios
- **Modular Command Structure**: Each command is self-contained with its own validation, processing, and formatting logic

### Data Flow
1. Command validation (file existence, accessibility checks)
2. Lazy loading of specialized analysis modules
3. Binary analysis and information extraction
4. Output formatting based on user preferences
5. Console output with appropriate error handling

## Key Responsibilities
- **Binary Analysis Orchestration**: Coordinates between CLI interface and specialized analysis adapters
- **User Experience**: Provides clear, actionable debugging information with toolchain-specific recommendations
- **Error Resilience**: Handles missing dependencies, invalid inputs, and analysis failures gracefully
- **Output Flexibility**: Supports both interactive debugging workflows and automated tooling integration

## Integration Points
- Depends on adapter modules (`@debugmcp/adapter-rust`) for core analysis functionality
- Uses Node.js file system APIs for binary access and validation
- Designed to extend easily with additional binary format support (PE, ELF, Mach-O, etc.)

This directory represents the user-facing command layer of a larger debugging toolchain analysis system, focusing on developer experience and actionable insights for debugging setup and compatibility.