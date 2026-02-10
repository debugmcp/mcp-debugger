# packages/adapter-java/src/java-adapter-factory.ts
@source-hash: 8e73bd89a5baa047
@generated: 2026-02-10T00:41:21Z

## Java Adapter Factory

Factory implementation for creating and validating Java debug adapter instances within the MCP debugger ecosystem. Serves as the primary entry point for Java debugging support.

### Core Responsibility
Implements the `IAdapterFactory` interface to provide dependency injection and environment validation for Java debugging capabilities using the Java Debugger (jdb).

### Key Components

**JavaAdapterFactory class (L24-103)**
- Main factory class implementing `IAdapterFactory`
- Handles adapter creation, metadata provision, and environment validation

**createAdapter() method (L28-30)**
- Factory method returning new `JavaDebugAdapter` instances
- Takes `AdapterDependencies` and delegates to adapter constructor

**getMetadata() method (L35-47)**
- Returns static adapter metadata including language type, version, and capabilities
- Specifies Java file extensions (.java, .class) and embedded SVG icon
- Documents jdb as the underlying debugging tool

**validate() method (L52-102)**
- Comprehensive environment validation for Java debugging prerequisites
- Validates Java executable availability and version (requires Java 8+)
- Verifies jdb (Java Debugger) presence and functionality
- Returns detailed validation results with errors, warnings, and environment info

### Dependencies
- `@debugmcp/shared`: Core interfaces (`IDebugAdapter`, `IAdapterFactory`, `AdapterDependencies`, etc.)
- `./java-debug-adapter.js`: The actual adapter implementation (L11)
- `./utils/java-utils.js`: Java environment detection utilities (L13-19)

### Validation Logic
Environment validation performs sequential checks:
1. Java executable discovery (L61)
2. Java version parsing and minimum version check (L64-72)
3. jdb availability and functionality validation (L75-83)

Returns structured result with validation status, error/warning arrays, and environment details including Java paths, version, platform info, and timestamps.

### Architecture Notes
- Uses async validation for environment checks
- Follows factory pattern with clear separation of concerns
- Provides detailed error reporting for troubleshooting
- Integrates with shared debugging infrastructure through well-defined interfaces