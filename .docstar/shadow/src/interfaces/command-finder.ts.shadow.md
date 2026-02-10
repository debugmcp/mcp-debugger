# src/interfaces/command-finder.ts
@source-hash: d4247b735492e106
@generated: 2026-02-10T00:41:43Z

## Purpose
TypeScript interface and error class for system command resolution functionality. Provides a contract for finding executable commands in the system PATH and handling command resolution failures.

## Key Components

### CommandFinder Interface (L4-12)
- **Purpose**: Contract for command resolution implementations
- **Method**: `find(command: string): Promise<string>` (L11)
  - Asynchronously resolves command name to full executable path
  - Throws `CommandNotFoundError` when command not found in PATH
  - Returns Promise<string> containing absolute path to executable

### CommandNotFoundError Class (L17-22)
- **Purpose**: Specialized error for command resolution failures
- **Extends**: Built-in Error class
- **Properties**:
  - `command: string` (L18) - readonly property storing the failed command name
- **Constructor** (L18-21): Sets error message format and error name for proper error identification

## Architecture Notes
- Interface follows async pattern (Promise-based) for potential I/O operations
- Error class uses readonly property pattern for immutable command reference
- Clean separation of concerns: interface defines contract, error class handles failure cases
- Designed for dependency injection pattern (interface-based)