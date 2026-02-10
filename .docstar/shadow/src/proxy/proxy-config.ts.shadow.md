# src/proxy/proxy-config.ts
@source-hash: f7a4c9bde41f40c1
@generated: 2026-02-09T18:15:04Z

## Primary Purpose
Defines the configuration interface for starting a debug proxy server, providing language-agnostic debugging configuration that bridges between different language-specific debuggers and a common adapter interface.

## Key Interface
**ProxyConfig (L9-30)** - Main configuration interface containing:
- Core session management: `sessionId` (L10), `language` (L11) 
- Adapter connection: `adapterHost` (L13), `adapterPort` (L14)
- Script execution: `scriptPath` (L16), `scriptArgs` (L17), `executablePath` (L12)
- Debug behavior: `stopOnEntry` (L18), `justMyCode` (L19), `initialBreakpoints` (L20)
- Operational settings: `logDir` (L15), `dryRunSpawn` (L21)
- Extension points: `launchConfig` (L22), `adapterCommand` (L25-29)

## Dependencies
- `@debugmcp/shared`: Imports `DebugLanguage` enum and `LanguageSpecificLaunchConfig` type (L4)

## Architectural Decisions
- **Language abstraction**: Uses `DebugLanguage` enum to support multiple debugging backends while maintaining unified interface
- **Optional adapter discovery**: `executablePath` is optional, allowing adapters to auto-discover executables
- **Flexible command specification**: `adapterCommand` object (L25-29) encapsulates spawn requirements with command, args, and environment
- **Extensibility**: `launchConfig` allows language-specific configuration injection without breaking interface

## Key Patterns
- **Configuration object pattern**: Single interface encapsulating all proxy startup requirements
- **Optional vs required separation**: Required fields for basic operation, optional fields for advanced features
- **Nested configuration**: `adapterCommand` and `initialBreakpoints` use structured sub-objects for complex data

## Critical Constraints
- `sessionId` must be unique for session isolation
- `adapterHost`/`adapterPort` must be valid network endpoints
- `scriptPath` must point to executable script/program
- `initialBreakpoints` requires valid file paths and line numbers