# packages/adapter-java/src/utils/java-utils.ts
@source-hash: 2e1296fe5ee9364d
@generated: 2026-02-10T00:41:12Z

## Primary Purpose

Java executable detection and validation utilities for a Java adapter package. Provides cross-platform discovery of Java and JDB executables using PATH-based lookup with Windows-specific handling (.exe extensions).

## Key Components

### Error Handling
- **CommandNotFoundError** (L21-28): Custom error class for command resolution failures, stores the failed command name

### Command Resolution
- **CommandFinder interface** (L33-35): Abstraction for executable path resolution
- **WhichCommandFinder** (L40-73): Implementation using 'which' library with caching support
  - Handles Windows .exe extension logic (L49-62)
  - Maintains internal cache for performance (L41, L65-66)
- **setDefaultCommandFinder()** (L82-86): Test utility for dependency injection

### Java Discovery
- **findJavaHome()** (L122-128): Reads and validates JAVA_HOME environment variable
- **findJavaExecutable()** (L136-211): Multi-strategy Java discovery:
  1. User-specified preferred path (L147-162)
  2. JAVA_HOME/bin/java candidates (L164-182) 
  3. PATH-based lookup (L184-203)
  - Returns first valid executable found or throws detailed error with tried paths
- **isValidJavaExecutable()** (L91-117): Validates executable by running `java -version` with 5s timeout

### Version Management
- **getJavaVersion()** (L217-246): Extracts version string from `java -version` output
- **parseJavaMajorVersion()** (L253-264): Parses major version from version strings, handles both old (1.8.x) and new (9+) format

### JDB (Java Debugger) Support
- **findJdb()** (L272-338): Multi-strategy JDB discovery similar to Java discovery:
  1. Derive from provided Java path's bin directory (L282-298)
  2. JAVA_HOME/bin/jdb candidates (L300-316)
  3. PATH-based lookup (L318-330)
- **validateJdb()** (L343-367): Validates JDB executable with version check and timeout

## Architecture Patterns

- **Strategy Pattern**: CommandFinder interface allows pluggable command resolution
- **Cross-platform abstraction**: Windows .exe handling throughout discovery functions
- **Defensive programming**: Comprehensive error handling with detailed failure reporting
- **Timeout protection**: All subprocess calls protected with 5-second timeouts
- **Caching**: CommandFinder implementation includes optional result caching

## Dependencies

- `child_process.spawn`: For executable validation and version detection
- `which`: Cross-platform PATH-based executable lookup
- `node:fs`, `node:path`: File system and path operations
- Local Logger interface (L10-13) with no-op default (L16-19)

## Critical Constraints

- All subprocess operations have 5-second timeouts to prevent hanging
- Java validation requires specific output patterns ("java version", "openjdk version", "Java(TM)")
- JDB validation is more lenient due to version support variations across JDB versions
- Windows platform detection drives .exe extension handling throughout