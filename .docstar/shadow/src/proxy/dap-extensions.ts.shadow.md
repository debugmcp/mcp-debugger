# src/proxy/dap-extensions.ts
@source-hash: f8cfb18816e79366
@generated: 2026-02-10T00:41:42Z

## Purpose
Defines extensions to the Debug Adapter Protocol (DAP) for the MCP Debugger proxy, specifically to support silent command injection without client responses.

## Key Interfaces
- **SilentDapCommandPayload (L12-14)**: Extends base DapCommandPayload with optional `__silent` flag for internal proxy command injection

## Dependencies
- `DapCommandPayload` from `./dap-proxy-interfaces.js` (L6) - Base DAP command structure

## Architecture
Uses TypeScript interface extension pattern to add internal metadata (`__silent` flag) to existing DAP command payloads. The double-underscore prefix indicates internal/private usage convention.

## Usage Context
Part of proxy layer that can inject DAP commands internally without triggering normal client-server response cycles, enabling transparent debugging operations.