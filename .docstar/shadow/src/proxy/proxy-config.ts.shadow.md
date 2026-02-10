# src/proxy/proxy-config.ts
@source-hash: f7a4c9bde41f40c1
@generated: 2026-02-10T00:41:50Z

**Purpose**: Defines the configuration interface for starting a debug proxy, providing language-agnostic proxy startup parameters for the MCP debug system.

**Key Interface**:
- `ProxyConfig` (L9-30): Main configuration interface containing all parameters needed to spawn and configure a debug proxy session

**Core Configuration Fields**:
- `sessionId` (L10): Unique identifier for the debug session
- `language` (L11): Debug language enum determining which debugger adapter to use
- `executablePath` (L12): Optional path to target executable (auto-discovered if omitted)
- `adapterHost/adapterPort` (L13-14): Network location where debug adapter should bind
- `logDir` (L15): Directory for debug session logs
- `scriptPath` (L16): Path to script/program being debugged
- `scriptArgs` (L17): Optional command-line arguments for target script

**Debug Control Options**:
- `stopOnEntry` (L18): Whether to pause execution at program entry point
- `justMyCode` (L19): Debug scope limitation flag
- `initialBreakpoints` (L20): Pre-configured breakpoints with file/line/condition
- `dryRunSpawn` (L21): Flag for testing spawn process without execution

**Advanced Configuration**:
- `launchConfig` (L22): Language-specific launch parameters via shared types
- `adapterCommand` (L25-29): Spawn command specification for debug adapter process including command, arguments, and environment variables

**Dependencies**:
- Imports `DebugLanguage` and `LanguageSpecificLaunchConfig` from shared module (L4)

**Architecture Notes**:
- Designed as language-agnostic configuration that can be specialized via `launchConfig`
- Separation of proxy configuration from adapter spawn details enables flexible deployment models
- Interface supports both auto-discovery (`executablePath` optional) and explicit configuration patterns