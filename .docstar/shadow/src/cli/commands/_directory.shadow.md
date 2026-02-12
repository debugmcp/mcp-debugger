# src\cli\commands/
@generated: 2026-02-12T21:00:55Z

## Purpose
The `src/cli/commands` directory contains CLI command handlers for a debugging MCP (Model Context Protocol) adapter system. This module provides command-line interfaces for analyzing and debugging various types of executable binaries, with current focus on Rust binary analysis.

## Core Architecture

### Command Handler Pattern
The directory follows a consistent command handler architecture where each file implements a specific CLI command with:
- Input validation and parameter processing
- Core analysis functionality (often delegated to adapter modules)
- Flexible output formatting (JSON and human-readable formats)
- Comprehensive error handling with user-friendly messages

### Lazy Loading Strategy
Commands implement lazy module loading to avoid startup overhead and provide graceful degradation when optional dependencies are missing. This pattern includes:
- Cached function references for expensive operations
- Dynamic imports with helpful error messages
- Build instruction guidance for missing components

## Key Components

### check-rust-binary.ts
Primary command for Rust executable analysis providing:
- **Entry Point**: `handleCheckRustBinaryCommand()` - Main command handler
- **Analysis**: Binary format detection, toolchain identification, debug info extraction
- **Output**: Dual-mode formatting (JSON/human-readable) with detailed compatibility reports
- **Dependencies**: Integration with `@debugmcp/adapter-rust` for core analysis functionality

## Public API Surface

### Command Handlers
- `handleCheckRustBinaryCommand(binaryPath: string, options?: CheckRustBinaryOptions): Promise<void>`

### Configuration Types
- `CheckRustBinaryOptions`: Command configuration with optional JSON output flag

### Output Utilities
- Standardized console output functions (`writeOutput`, `writeError`)
- Flexible formatting system supporting both structured and human-readable output

## Internal Organization

### Data Flow
1. Command invocation with binary path and options
2. Input validation (file existence, accessibility)
3. Lazy loading of analysis modules
4. Binary analysis and information extraction
5. Output formatting based on user preferences
6. Results written to stdout/stderr

### Error Handling Strategy
- Graceful degradation for missing dependencies
- User-friendly error messages with actionable guidance
- Build instruction provision for development scenarios
- Fallback handling for incomplete analysis results

## Important Patterns

### Modular Design
- Clear separation between command logic and analysis functionality
- Adapter pattern for pluggable binary analysis backends
- Consistent interface design across command handlers

### User Experience Focus
- Comprehensive help text and error guidance
- Multiple output formats for different use cases
- Toolchain-specific recommendations and compatibility advice
- Runtime dependency filtering and presentation

This directory serves as the CLI interface layer for the debugging MCP system, providing user-accessible commands that leverage specialized adapter modules for binary analysis and debugging assistance.