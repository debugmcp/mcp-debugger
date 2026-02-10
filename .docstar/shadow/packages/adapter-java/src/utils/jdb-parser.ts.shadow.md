# packages/adapter-java/src/utils/jdb-parser.ts
@source-hash: db3a005b1602111a
@generated: 2026-02-09T18:13:55Z

## Purpose
Parser utility for converting JDB (Java Debugger) text-based output into structured data for the Debug Adapter Protocol (DAP). JDB outputs unstructured text that requires regex parsing to extract debugging information.

## Key Interfaces

### JdbStoppedEvent (L13-22)
Represents parsed debugger stop events with reason ('breakpoint'|'step'|'pause'|'entry'), thread information, and optional location data (className, methodName, line).

### JdbStackFrame (L27-34)
Stack frame structure containing id, name, className, methodName, file, and line number for stack trace representation.

### JdbVariable (L39-45)
Variable representation with name, value, type, expandable flag, and optional objectId for object instances.

### JdbThread (L50-55)
Thread information including id, name, state, and optional groupName.

## Core Parser Class

### JdbParser (L60-405)
Static utility class providing text parsing methods for various JDB outputs.

#### Event Parsing
- `parseStoppedEvent()` (L68-109): Parses breakpoint hits and step completion events using regex patterns for different JDB output formats
- `isVMStarted()` (L290-292): Detects VM startup messages
- `isTerminated()` (L298-302): Identifies program termination events

#### Debug Information Parsing
- `parseStackTrace()` (L119-155): Extracts stack frames from 'where' command output, handling both regular methods and native methods
- `parseLocals()` (L168-222): Parses local variables from 'locals' command, categorizing primitives, objects with IDs, and null values
- `parseThreads()` (L234-266): Extracts thread information from 'threads' command with group parsing support

#### Utility Methods
- `isPrompt()` (L272-276): Detects JDB prompt patterns ("> " or "main[1] ")
- `extractPrompt()` (L281-284): Extracts specific prompt string
- `parseError()` (L307-330): Identifies and extracts error messages from JDB output
- `parseBreakpointSet()`/`parseBreakpointCleared()` (L387-404): Handles breakpoint confirmation messages

#### Helper Methods
- `threadNameToId()` (L336-344): Converts thread names to numeric IDs using hash function for DAP compatibility
- `inferType()` (L349-380): Infers Java types from string values (String, boolean, int, double, null, Object)

## Architecture Notes
- All parsing methods are static for stateless operation
- Extensive regex patterns handle JDB's varied output formats
- Robust error handling with fallback patterns
- Thread ID generation ensures consistent mapping between thread names and numeric IDs
- Type inference supports common Java primitive and reference types

## Dependencies
No external dependencies - uses only TypeScript/JavaScript standard library features.