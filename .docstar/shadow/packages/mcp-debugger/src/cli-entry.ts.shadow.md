# packages/mcp-debugger/src/cli-entry.ts
@source-hash: 943ef53658065820
@generated: 2026-02-10T00:41:27Z

## Primary Purpose
CLI entry point shim for npx usage that handles critical console silencing before delegating to the main MCP debugger implementation. Ensures MCP protocol compliance by preventing stdout pollution in transport modes.

## Key Components

### Console Silencing Logic (L9-63)
**IIFE (L9-63)**: Critical initialization block that must execute before any imports
- **normalizeArg (L10)**: Converts arguments to lowercase strings for comparison
- **stripQuotes (L11)**: Removes surrounding quotes from argument values  
- **matchesKeyword (L12-19)**: Flexible argument matching supporting both exact matches and key=value patterns

**Transport Detection (L22-38)**:
- Detects stdio transport via `hasStdio` (L22)
- Detects SSE transport via `hasSse` (L23) 
- Auto-detection logic considers explicit args, environment variables, default behavior, and stdin pipe detection
- `shouldSilenceConsole` (L35-38): Comprehensive condition covering all silencing scenarios

**Console Method Nullification (L44-57)**: Replaces all console methods with no-op functions to prevent protocol interference

### Argument Processing (L65-68)
Strips quotes from all command line arguments before processing

### Bootstrap Logic (L76-90)
**bootstrap function (L76-90)**: 
- Sets skip auto-start flag (L71) to prevent duplicate initialization
- Imports batteries-included module (L74) for adapter bundling
- Dynamically imports main from root source (L79)
- Handles fatal errors with conditional logging based on console silencing state

## Key Dependencies
- `./batteries-included.js` (L74): Ensures all MCP adapters are bundled
- `../../../src/index.js` (L79): Root implementation containing main() function

## Architectural Decisions
1. **Console silencing first**: Critical requirement to prevent MCP protocol corruption
2. **Dynamic imports**: Avoids premature module loading before console silencing
3. **Environment flag coordination**: Uses `CONSOLE_OUTPUT_SILENCED` and `DEBUG_MCP_SKIP_AUTO_START` for cross-module communication
4. **Flexible argument parsing**: Handles quoted/unquoted arguments and various formats

## Critical Invariants
- Console silencing MUST execute before ANY imports to prevent stdout pollution
- Error handling respects console silencing state to maintain protocol compliance
- Bootstrap process sets flags to coordinate with main implementation