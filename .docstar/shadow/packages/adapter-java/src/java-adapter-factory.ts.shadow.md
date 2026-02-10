# packages/adapter-java/src/java-adapter-factory.ts
@source-hash: 8e73bd89a5baa047
@generated: 2026-02-09T18:14:30Z

## Primary Purpose
Factory class for creating Java debug adapter instances that integrates with the debugMCP framework's dependency injection system. Validates Java/jdb environment prerequisites before adapter creation.

## Core Architecture

**JavaAdapterFactory (L24-102)** - Main factory class implementing `IAdapterFactory` interface
- **createAdapter (L28-30)** - Factory method that instantiates `JavaDebugAdapter` with provided dependencies
- **getMetadata (L35-47)** - Returns static adapter metadata including language info, version, supported file extensions (.java, .class), and embedded SVG icon
- **validate (L52-102)** - Comprehensive async environment validation checking Java executable, version compliance (≥8), and jdb debugger availability

## Dependencies & Integration
- **Core Interfaces**: `IDebugAdapter`, `IAdapterFactory`, `AdapterDependencies`, `AdapterMetadata` from `@debugmcp/shared`
- **Adapter Implementation**: `JavaDebugAdapter` from local module
- **Validation Utilities**: Java environment detection functions (`findJavaExecutable`, `getJavaVersion`, `parseJavaMajorVersion`, `findJdb`, `validateJdb`) from `./utils/java-utils.js`

## Key Behavior Patterns
- **Environment Validation Strategy**: Multi-stage validation collecting errors/warnings rather than failing fast
- **Version Requirement**: Enforces Java 8+ minimum version (L67-69)
- **Graceful Degradation**: Continues validation even when Java version detection fails, recording as warning (L70-72)
- **Detailed Diagnostics**: Returns comprehensive validation results including system environment details (L93-100)

## Critical Constraints
- Requires Java executable in PATH or JAVA_HOME
- jdb (Java Debugger) must be available and functional
- Factory creation always succeeds, but validation may indicate unusable environment
- Adapter metadata is static and version-locked to "1.0.0"