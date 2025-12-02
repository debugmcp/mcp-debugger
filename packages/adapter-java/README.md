# Java Debug Adapter for MCP Debugger

Debug Java applications using jdb (Java Debugger) through the Model Context Protocol.

## Status

**Phase 1: Foundation - COMPLETED ✅**

The basic adapter structure is in place and compiles successfully:

- ✅ Java executable detection (`findJavaExecutable`)
- ✅ Java version parsing and validation
- ✅ jdb (Java Debugger) detection
- ✅ Adapter factory implementation
- ✅ Adapter skeleton with all required interfaces
- ✅ Integration with monorepo build system

**Phase 2: JDB Wrapper - COMPLETED ✅**

JDB process management and output parsing implemented:

- ✅ `JdbParser` class - Parse jdb text output to structured data
  - Breakpoint hit detection
  - Stack trace parsing
  - Local variable parsing
  - Thread list parsing
  - Error detection
  - Prompt and event detection
- ✅ `JdbWrapper` class - Manage jdb process lifecycle
  - Process spawning with proper configuration
  - Command queue system for sequential execution
  - Breakpoint management (set/clear)
  - Stepping operations (over/into/out)
  - Stack inspection and variable evaluation
  - Thread management
  - Event emission (stopped, continued, terminated)

**Phase 3: DAP Translation Server - COMPLETED ✅**

DAP protocol server that bridges MCP and jdb implemented:

- ✅ `jdb-dap-server.ts` - Standalone Node.js DAP server (620 lines)
  - TCP server listening for DAP client connections
  - Content-Length protocol parsing (DAP message format)
  - Complete DAP request handling:
    - `initialize` - Capability negotiation
    - `launch` - Start debugging with JdbWrapper
    - `setBreakpoints` - Manage breakpoints
    - `configurationDone` - Begin execution
    - `threads`, `stackTrace`, `scopes`, `variables` - Inspection
    - `continue`, `next`, `stepIn`, `stepOut` - Control flow
    - `evaluate` - Expression evaluation
    - `disconnect` - Clean shutdown
  - Event translation: jdb events → DAP events
  - Proper sequence number management
  - Error handling and cleanup

## Architecture

### Overview

The Java adapter uses jdb (Java Debugger), which is a command-line debugger included with the Java JDK. Since jdb uses a text-based interface rather than the Debug Adapter Protocol (DAP), we implement a translation layer:

```
MCP Client → SessionManager → ProxyManager → jdb-dap-server → jdb
                                                     ↓
                                               JdbWrapper
                                                     ↓
                                                JdbParser
```

### Key Components

1. **JavaAdapterFactory** (`src/java-adapter-factory.ts`)
   - Implements `IAdapterFactory` interface
   - Validates Java/jdb environment
   - Creates JavaDebugAdapter instances

2. **JavaDebugAdapter** (`src/java-debug-adapter.ts`)
   - Implements `IDebugAdapter` interface
   - Manages adapter lifecycle and state
   - Transforms launch configurations
   - Reports capabilities

3. **Java Utilities** (`src/utils/java-utils.ts`)
   - `findJavaExecutable()` - Locate Java runtime
   - `getJavaVersion()` - Get Java version
   - `parseJavaMajorVersion()` - Parse version (handles old 1.8.x and new 9+ formats)
   - `findJdb()` - Locate jdb debugger
   - `validateJdb()` - Verify jdb works

## Requirements

- Java JDK 8 or higher (includes jdb)
- JAVA_HOME environment variable (recommended)
- Node.js 18+ for running the adapter

## Installation

```bash
# Install dependencies
pnpm install

# Build the adapter
pnpm run build

# Run tests
pnpm test
```

## Usage

The adapter will be automatically discovered and loaded by the MCP debugger when a Java debug session is requested:

```json
{
  "language": "java",
  "name": "Debug HelloWorld",
  "program": "/path/to/HelloWorld.java"
}
```

## Next Steps (Phase 4-5)

### Phase 4: Integration (NEXT)
- [ ] Connect JavaDebugAdapter to jdb-dap-server
- [ ] Implement full launch configuration support
- [ ] Add classpath management
- [ ] Support for packages and fully-qualified class names

### Phase 5: Testing & Polish
- [ ] Unit tests for all components
- [ ] Integration tests
- [ ] E2E tests with real Java programs
- [ ] Documentation and examples

## Known Limitations

- **Conditional Breakpoints**: jdb does not natively support conditional breakpoints
- **Watch Expressions**: Limited support in jdb
- **Hot Code Replace**: Not supported through jdb
- **Multi-module Projects**: Requires proper classpath configuration

## JDB Command Reference

Key jdb commands that will be used:

| Command | Purpose |
|---------|---------|
| `run [args]` | Start debugging |
| `stop at <class>:<line>` | Set line breakpoint |
| `stop in <class>.<method>` | Set method breakpoint |
| `clear <class>:<line>` | Remove breakpoint |
| `step` | Step into |
| `next` | Step over |
| `step up` | Step out |
| `cont` | Continue execution |
| `where` | Show stack trace |
| `locals` | Show local variables |
| `print <expr>` | Evaluate expression |
| `threads` | List threads |
| `thread <id>` | Switch thread |

## Contributing

This adapter follows the MCP debugger adapter patterns:

1. All adapters implement `IDebugAdapter` from `@debugmcp/shared`
2. Adapters are discovered dynamically via `AdapterRegistry`
3. Each adapter exports a factory class: `{Language}AdapterFactory`
4. Comprehensive testing required (unit, integration, e2e)

## License

MIT - See root LICENSE file
