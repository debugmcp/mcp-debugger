# packages/adapter-java/src/utils/
@generated: 2026-02-10T01:19:41Z

## Purpose and Responsibility

The `utils` directory provides the core Java debugging infrastructure for the Java Debug Adapter. It abstracts the complexity of discovering, launching, and communicating with the Java Debugger (jdb) command-line tool, transforming raw JDB interactions into structured debugging capabilities compatible with the Debug Adapter Protocol (DAP).

## Key Components and Integration

### Three-Layer Architecture

1. **Discovery Layer (`java-utils.ts`)**
   - Cross-platform Java/JDB executable discovery and validation
   - Supports multiple resolution strategies (JAVA_HOME, PATH, user-specified)
   - Provides version detection and executable validation with timeout protection

2. **Communication Layer (`jdb-wrapper.ts`)**
   - High-level JDB process management and command orchestration
   - Event-driven architecture extending EventEmitter for async debugging
   - Queued command execution system with timeout handling
   - Supports both launch mode (start new JVM) and attach mode (connect to running JVM)

3. **Translation Layer (`jdb-parser.ts`)**
   - Converts unstructured JDB text output into structured TypeScript interfaces
   - Regex-based parsing of debugging events, stack traces, variables, and thread information
   - Maps Java types and values to DAP-compatible representations

### Component Interaction Flow

```
Java Discovery → JDB Process Launch/Attach → Command Execution → Output Parsing → DAP Events
```

- `java-utils` locates and validates Java/JDB executables
- `jdb-wrapper` spawns the JDB process using discovered executables
- `jdb-wrapper` sends debugging commands and receives raw output
- `jdb-parser` transforms raw output into structured debugging data
- `jdb-wrapper` emits standardized debugging events for consumption by the adapter

## Public API Surface

### Primary Entry Points

**JdbWrapper Class:**
- `spawn(config)` / `attach(config)`: Initialize debugging session
- `setBreakpoint()` / `clearBreakpoint()`: Breakpoint management
- `continue()`, `stepOver()`, `stepIn()`, `stepOut()`: Execution control
- `getStackTrace()`, `getLocals()`, `getThreads()`: State inspection
- Event emissions: 'stopped', 'continued', 'terminated', 'error'

**Java Discovery Functions:**
- `findJavaExecutable(preferredPath?)`: Multi-strategy Java discovery
- `findJdb(javaPath?)`: JDB executable resolution
- `getJavaVersion()`, `parseJavaMajorVersion()`: Version management

**JDB Parser (Static Methods):**
- `parseStoppedEvent()`: Breakpoint/step event parsing
- `parseStackTrace()`, `parseLocals()`, `parseThreads()`: State parsing
- `isPrompt()`, `isVMStarted()`, `isTerminated()`: State detection

## Internal Organization and Data Flow

### Command Processing Pipeline
1. Commands queued in `jdb-wrapper` with timeout handling
2. Direct process communication via stdin/stdout pipes
3. Output buffering and event detection in real-time
4. Parsed events trigger appropriate DAP-compatible emissions

### Configuration Management
- **JdbConfig**: Unified configuration supporting both launch and attach modes
- **Cross-platform handling**: Automatic Windows .exe extension resolution
- **Environment integration**: JAVA_HOME and PATH-based discovery

### State Management
- Breakpoint tracking with verification status
- Thread information caching
- Process lifecycle management with cleanup

## Important Patterns and Conventions

### Error Handling Strategy
- Custom error types (CommandNotFoundError) with detailed context
- Timeout protection on all subprocess operations (5-second default)
- Comprehensive error detection across multiple JDB output patterns

### Cross-Platform Compatibility
- Windows .exe extension handling throughout discovery
- Platform-specific command resolution via 'which' library
- Path separator and executable extension abstraction

### Performance Optimizations
- Command finder caching to avoid repeated PATH lookups
- Direct command sending for non-blocking execution control
- Buffer management for real-time output processing

### Testing Support
- Dependency injection via `setDefaultCommandFinder()`
- Configurable command resolution for test environments
- Comprehensive validation with detailed error reporting

This utility module serves as the foundation for Java debugging capabilities, providing reliable process management, robust executable discovery, and accurate parsing of JDB output into structured debugging data suitable for IDE integration.