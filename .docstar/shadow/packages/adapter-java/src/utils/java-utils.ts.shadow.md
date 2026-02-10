# packages/adapter-java/src/utils/java-utils.ts
@source-hash: 2e1296fe5ee9364d
@generated: 2026-02-09T18:13:57Z

## Purpose
Java executable detection and validation utilities for a Java adapter package. Provides cross-platform discovery of Java runtime and debugging tools using PATH resolution and environment variables.

## Key Components

### Core Classes & Interfaces
- **Logger (L10-13)**: Simple logging interface with error/debug methods, kept local to avoid external dependencies
- **CommandNotFoundError (L21-28)**: Custom error class for missing executable commands
- **CommandFinder (L33-35)**: Interface for resolving executable commands to full paths
- **WhichCommandFinder (L40-73)**: Production implementation using 'which' library with caching support and Windows .exe handling

### Command Resolution
- **setDefaultCommandFinder (L82-86)**: Dependency injection for testing - allows swapping command finder implementation
- **defaultCommandFinder (L76)**: Module-level singleton WhichCommandFinder instance

### Java Executable Discovery
- **findJavaHome (L122-128)**: Locates JAVA_HOME environment variable and validates directory existence
- **findJavaExecutable (L136-211)**: Main Java discovery function with 3-tier fallback:
  1. User-specified preferred path
  2. JAVA_HOME/bin/java (with Windows .exe variants)
  3. PATH-based 'java' command resolution
- **isValidJavaExecutable (L91-117)**: Validates Java executables by running `-version` and checking output patterns

### Version Handling  
- **getJavaVersion (L217-246)**: Extracts version string from `java -version` output with stderr capture
- **parseJavaMajorVersion (L253-264)**: Parses major version numbers from both legacy (1.8.x) and modern (9+) Java version formats

### Java Debugger Support
- **findJdb (L272-338)**: Locates Java Debugger with same 3-tier fallback strategy as Java executable
- **validateJdb (L343-368)**: Validates jdb functionality with version check and flexible exit code handling

## Architecture Patterns
- **Strategy Pattern**: CommandFinder interface with pluggable implementations for testing
- **Caching**: WhichCommandFinder caches resolved paths to avoid repeated filesystem lookups  
- **Cross-platform Handling**: Windows-specific .exe extension logic throughout
- **Graceful Degradation**: Multiple fallback strategies for executable discovery
- **Process Management**: Consistent 5-second timeouts and proper child process cleanup

## Dependencies
- Node.js built-ins: `child_process`, `fs`, `path`
- External: `which` library for PATH-based executable resolution

## Critical Invariants
- All spawn operations include 5-second timeouts to prevent hanging
- Java validation requires exit code 0 AND recognizable version output patterns
- Windows compatibility requires trying both .exe and non-.exe variants
- Error messages include detailed "tried paths" for debugging failed discoveries