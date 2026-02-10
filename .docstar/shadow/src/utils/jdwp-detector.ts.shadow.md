# src/utils/jdwp-detector.ts
@source-hash: 0d18668038d337db
@generated: 2026-02-09T18:15:06Z

## Purpose
Utility module for detecting JDWP (Java Debug Wire Protocol) configuration from running Java processes. Enables runtime inspection of Java debugger settings to determine suspend mode and connection details.

## Core Interface
- **JdwpConfig** (L11-15): Configuration object containing:
  - `suspend: boolean` - Whether debugger suspends process startup
  - `port?: number` - Debug port number (optional)
  - `address?: string` - Full address string (optional)

## Key Functions

### detectSuspendByPort(port: number) (L20-42)
Discovers JDWP suspend mode by port number. Uses `lsof` command to find process ID listening on specified port, then delegates to PID-based detection. Returns `boolean | null` (null if port not found or command fails).

### detectSuspendByPid(pid: number) (L47-70)
Detects JDWP suspend mode by process ID. Reads `/proc/{pid}/cmdline` to extract command-line arguments, searches for JDWP agent parameters (`agentlib:jdwp=` or `Xrunjdwp:`), then parses configuration. Linux-specific implementation.

### parseJdwpArgument(arg: string) (L79-115)
Parses JDWP agent argument strings into structured configuration. Handles both `-agentlib:jdwp=` and `-Xrunjdwp:` formats. Extracts:
- `suspend` parameter (y/n → boolean)
- `address` parameter with port extraction via regex `/:?(\d+)$/`
- Only returns config if suspend setting is found

## Dependencies
- `fs.readFileSync`: For reading process cmdline files
- `child_process.execSync`: For executing `lsof` commands with 5-second timeout

## Architecture Notes
- Error-tolerant design: All functions return null on failures rather than throwing
- Platform-specific: PID detection relies on Linux `/proc` filesystem
- Port detection uses Unix `lsof` utility
- Parsing handles multiple JDWP argument formats and address variations

## Critical Constraints
- Requires Linux environment for PID-based detection
- Needs `lsof` utility available in PATH for port-based detection
- Process must have read access to `/proc/{pid}/cmdline` files
- 5-second timeout on external command execution