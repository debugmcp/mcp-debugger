# src/proxy/dap-extensions.ts
@source-hash: f8cfb18816e79366
@generated: 2026-02-09T18:14:59Z

## Purpose
Extends the Debug Adapter Protocol (DAP) with MCP (Model Context Protocol) debugger-specific functionality to support silent command injection in proxy environments.

## Key Interfaces

**SilentDapCommandPayload (L12-13)**
- Extends base `DapCommandPayload` with optional `__silent` flag
- Used internally by proxy to inject DAP commands without triggering response mechanisms
- The double underscore prefix indicates internal/private usage convention
- Optional boolean flag allows selective silencing of commands

## Dependencies
- `DapCommandPayload` from `./dap-proxy-interfaces.js` (L6) - Base DAP command structure

## Architecture Notes
- Follows extension pattern rather than modification of core DAP types
- Uses optional property to maintain backward compatibility
- Double underscore naming suggests internal proxy mechanism
- Minimal surface area - single extension interface for specific use case

## Usage Context
File serves as bridge between standard DAP protocol and MCP debugger proxy requirements, enabling transparent command injection without disrupting normal DAP communication flow.