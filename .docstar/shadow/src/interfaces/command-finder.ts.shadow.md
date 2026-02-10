# src/interfaces/command-finder.ts
@source-hash: d4247b735492e106
@generated: 2026-02-09T18:14:59Z

## Purpose
Defines the contract for finding executable commands in the system PATH and provides error handling for command resolution failures.

## Key Components

### CommandFinder Interface (L4-12)
- **Purpose**: Abstraction for command discovery services
- **Core Method**: `find(command: string): Promise<string>` (L11)
  - Resolves command name to full executable path
  - Returns Promise for async PATH traversal
  - Throws CommandNotFoundError on failure

### CommandNotFoundError Class (L17-22)
- **Purpose**: Specialized error for command resolution failures
- **Properties**: 
  - `command: string` (L18) - readonly reference to failed command
  - `name: 'CommandNotFoundError'` (L20) - error type identifier
- **Constructor**: Formats error message with command name (L19)

## Architectural Patterns
- **Interface Segregation**: Single-responsibility interface for command finding
- **Custom Error Types**: Provides semantic error handling beyond generic Error
- **Async API**: Promise-based for non-blocking PATH operations

## Usage Context
This interface would typically be implemented by platform-specific command finders that traverse system PATH, check file permissions, and resolve executable extensions (e.g., .exe on Windows).