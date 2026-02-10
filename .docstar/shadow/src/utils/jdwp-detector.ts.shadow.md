# src/utils/jdwp-detector.ts
@source-hash: 0d18668038d337db
@generated: 2026-02-10T00:41:51Z

**Purpose**: JDWP (Java Debug Wire Protocol) detector utility that extracts debug configuration from running Java processes on Linux systems.

**Core Interface**:
- `JdwpConfig` (L11-15): Configuration object containing `suspend` flag, optional `port` and `address`

**Main Detection Functions**:
- `detectSuspendByPort(port)` (L20-42): Finds process listening on specified port using `lsof`, then delegates to PID-based detection
- `detectSuspendByPid(pid)` (L47-70): Reads `/proc/{pid}/cmdline` to extract Java command line arguments and parse JDWP configuration
- `parseJdwpArgument(arg)` (L79-115): Parses JDWP agent strings from Java command line arguments

**Dependencies**:
- Node.js `fs.readFileSync` for reading `/proc` filesystem
- Node.js `child_process.execSync` for executing `lsof` command

**Key Patterns**:
- Linux-specific implementation using `/proc` filesystem and `lsof`
- Graceful error handling: returns `null` on any failure rather than throwing
- Supports both `-agentlib:jdwp=` and `-Xrunjdwp:` argument formats
- Parses comma-separated key=value JDWP parameters
- Extracts port numbers from various address formats (`5005`, `*:5005`, `localhost:5005`)

**Constraints**:
- Only works on Linux systems (relies on `/proc` filesystem)
- Requires `lsof` command availability
- 5-second timeout on `lsof` execution
- Only returns configuration if `suspend` parameter is found in JDWP arguments

**Architecture**: Pure utility functions with no state, designed for integration into larger debugging/monitoring systems.