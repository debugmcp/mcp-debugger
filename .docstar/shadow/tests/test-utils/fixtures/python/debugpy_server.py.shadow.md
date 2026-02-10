# tests/test-utils/fixtures/python/debugpy_server.py
@source-hash: 7558beaff6bfb3b2
@generated: 2026-02-09T18:14:24Z

## Primary Purpose
Test fixture that implements a debugpy server for MCP debugging tests. Acts as a DAP (Debug Adapter Protocol) server that MCP servers can connect to as clients for debugging integration testing.

## Key Functions

### `start_debugpy_server(host, port, wait_for_client)` (L25-53)
Core server initialization function. Starts debugpy in listening mode on specified host/port. Uses `debugpy.listen()` to create server socket and optionally `debugpy.wait_for_client()` to block until client connection. Returns boolean success status.

### `fibonacci(n)` (L55-70)
Simple recursive Fibonacci calculator for debugging demonstration. Includes debug print statements to trace execution flow. Used as test payload for debugging sessions.

### `run_fibonacci_test()` (L72-82)
Test execution function that sets programmatic breakpoint via `debugpy.breakpoint()` and runs fibonacci calculation. Designed to provide debugging targets for client connection testing.

## Configuration Constants
- `DEFAULT_HOST = "127.0.0.1"` (L22)
- `DEFAULT_PORT = 5679` (L23) - Uses non-standard port to avoid conflicts

## Command Line Interface (L84-110)
Argument parser supporting:
- `--host`: Server bind address
- `--port`: Server bind port  
- `--no-wait`: Skip client connection waiting
- `--run-test`: Execute fibonacci test with breakpoint

## Execution Modes
1. **Server mode** (L100-106): Runs indefinitely with keyboard interrupt handling
2. **Test mode** (L97-98): Executes fibonacci test then maintains server
3. **Always includes 5-second cleanup delay** (L109-110)

## Dependencies
- `debugpy`: Core DAP server implementation (L14-19 with import validation)
- Standard library: `sys`, `os`, `time`, `argparse`

## Architecture Notes
Implements proper debugpy server pattern where this script acts as server and external MCP processes connect as clients. Contrasts with typical debugging where debugger connects to target process.