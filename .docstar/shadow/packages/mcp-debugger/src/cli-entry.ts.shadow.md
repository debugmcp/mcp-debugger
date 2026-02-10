# packages/mcp-debugger/src/cli-entry.ts
@source-hash: 943ef53658065820
@generated: 2026-02-09T18:14:34Z

## Primary Purpose
CLI entry point shim for the MCP debugger that enables standalone npx usage while preserving critical MCP protocol compatibility through intelligent console output silencing.

## Core Functionality

**Console Silencing Logic (L9-63)**
- Critical IIFE that runs before any imports to prevent stdout pollution in MCP transport modes
- Auto-detects when console silencing is needed based on:
  - Explicit `stdio` transport argument detection (L22)
  - Explicit `sse` transport argument detection (L23) 
  - Environment variable `CONSOLE_OUTPUT_SILENCED=1` (L37)
  - Default behavior when no transport specified and stdin is piped (L31-38)
- Completely disables all console methods (L44-57) and process warnings (L59-61)

**Argument Processing (L10-19, L66-68)**
- `normalizeArg()`, `stripQuotes()`, `matchesKeyword()` helper functions handle quoted/unquoted CLI arguments
- Cleans `process.argv` by stripping surrounding quotes from all arguments

**Bootstrap Process (L70-98)**
- Sets `DEBUG_MCP_SKIP_AUTO_START=1` to prevent auto-execution by core module
- Imports batteries-included module (L74) to ensure adapter bundling
- `bootstrap()` function (L76-90) dynamically imports and executes main() from `../../../src/index.js`
- Dual-level error handling respects console silencing state

## Key Dependencies
- `./batteries-included.js` - Ensures all MCP adapters are bundled
- `../../../src/index.js` - Core debugger main() implementation

## Critical Constraints
1. Console silencing MUST execute before any imports to prevent MCP protocol corruption
2. Quote stripping must handle both single and double quotes in CLI arguments
3. Error output must respect silencing state to maintain protocol compatibility

## Architectural Patterns
- IIFE pattern for early console silencing initialization
- Environment variable coordination between CLI shim and core module
- Dynamic import pattern to defer core module loading until after setup
- Fail-fast error handling with appropriate exit codes