# src/cli/commands/
@generated: 2026-02-09T18:16:07Z

## Purpose

The `src/cli/commands` directory contains CLI command handlers that provide debugging tools and utilities for analyzing executable binaries. This module serves as the command-line interface layer, translating user commands into actionable analysis operations and presenting results in user-friendly formats.

## Key Components

### Binary Analysis Commands
- **check-rust-binary**: Comprehensive Rust binary analyzer that determines toolchain compatibility, debug information availability, and debugging setup requirements

### Command Architecture Pattern
All commands follow a consistent pattern:
- Main handler function as primary entry point
- Input validation and path resolution
- Adapter integration for specialized analysis
- Dual output formatting (JSON and human-readable)
- Error handling with actionable guidance

## Public API Surface

### Entry Points
- `handleCheckRustBinaryCommand(options)`: Analyzes Rust executables for debugging compatibility

### Configuration Interfaces
- `CheckRustBinaryOptions`: Standard command options supporting JSON output mode

## Internal Organization

### Lazy Loading Architecture
Commands use dynamic imports to handle optional dependencies gracefully, allowing the CLI to function even when specialized adapters are not installed.

### Adapter Integration Layer
Commands interface with domain-specific adapters (e.g., `@debugmcp/adapter-rust`) to perform deep binary analysis while maintaining separation of concerns.

### Output Formatting System
Dual-mode output system provides:
- **JSON mode**: Machine-readable structured data for programmatic consumption
- **Human-readable mode**: Formatted reports with actionable recommendations and color-coded status information

## Data Flow

1. **Command Parsing**: CLI framework routes commands to appropriate handlers
2. **Input Validation**: File path validation and accessibility checks
3. **Adapter Invocation**: Specialized analysis through domain adapters
4. **Result Processing**: Raw analysis data transformed into user-friendly insights
5. **Output Generation**: Formatted results delivered via console output utilities

## Important Patterns

### Error Context Enhancement
Commands wrap technical errors with user-actionable guidance, particularly for missing dependencies and setup requirements.

### Toolchain-Specific Intelligence
Analysis results include platform and toolchain-specific recommendations, helping users understand debugging limitations and required setup steps.

### Dependency Filtering
Runtime dependency analysis filters for relevant system libraries, focusing user attention on critical compatibility factors.

## Module Conventions

- Consistent error handling with contextual guidance
- Lazy loading for optional dependencies
- Standardized output formatting utilities
- File system operations using async/await patterns
- Configuration through typed option interfaces