# packages/adapter-java/src/utils/jdb-parser.ts
@source-hash: db3a005b1602111a
@generated: 2026-02-10T00:41:10Z

## JDB Output Parser for Java Debug Adapter

**Primary Purpose**: Converts unstructured text output from JDB (Java Debugger) into structured TypeScript interfaces for the Debug Adapter Protocol (DAP). Acts as the critical translation layer between JDB's command-line output and the VS Code debugging protocol.

### Core Interfaces

- **JdbStoppedEvent (L13-22)**: Represents execution breakpoints with reason ('breakpoint'|'step'|'pause'|'entry'), thread info, and optional location data
- **JdbStackFrame (L27-34)**: Stack frame representation with ID, name, class/method details, file, and line number
- **JdbVariable (L39-45)**: Variable data including name, value, type, expandability flag, and optional object ID for complex types
- **JdbThread (L50-55)**: Thread information with ID, name, state, and optional group name

### Main Parser Class: JdbParser (L60-405)

**Static Methods for Pattern Matching**:

- **parseStoppedEvent (L68-109)**: Regex-based parsing of breakpoint hits and step completion messages. Handles two patterns: breakpoint hits and step completion events with location extraction
- **parseStackTrace (L119-155)**: Parses 'where' command output into stack frames. Handles both regular methods with source locations and native methods
- **parseLocals (L168-222)**: Extracts local variables from 'locals' command output. Supports primitives, object instances with IDs, and null values
- **parseThreads (L234-266)**: Parses 'threads' command output with group organization. Handles both hex and decimal thread IDs

**State Detection Methods**:
- **isPrompt (L272-276)**: Detects JDB readiness via prompt patterns
- **isVMStarted (L290-292)**: VM initialization detection
- **isTerminated (L298-302)**: Program termination detection
- **parseError (L307-330)**: Error message extraction with multiple pattern matching

**Utility Methods**:
- **threadNameToId (L336-344)**: Hash function converting thread names to numeric IDs for DAP compatibility
- **inferType (L349-380)**: Type inference from JDB value strings (String, boolean, int, double, null, Object)
- **parseBreakpointSet (L387-396)**: Breakpoint confirmation parsing
- **parseBreakpointCleared (L402-404)**: Breakpoint removal confirmation

### Key Patterns & Architecture

**Regex Strategy**: Heavy use of regex patterns to extract structured data from JDB's free-form text output. Each parsing method handles multiple output variations.

**DAP Integration**: All interfaces designed to align with Debug Adapter Protocol requirements, particularly thread ID handling and variable representation.

**Error Handling**: Comprehensive error detection across multiple JDB error message formats with fallback generic detection.

**Type System**: Java type inference system that maps JDB value representations to Java type names for proper DAP variable typing.