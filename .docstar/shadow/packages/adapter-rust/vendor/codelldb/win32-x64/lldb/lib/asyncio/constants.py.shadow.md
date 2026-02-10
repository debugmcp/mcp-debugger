# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/constants.py
@source-hash: 873fc2f9e66313c3
@generated: 2026-02-09T18:11:13Z

## Primary Purpose
Configuration constants file for Python's asyncio module, containing timeout values, buffer sizes, and operational thresholds for asynchronous I/O operations.

## Key Constants and Configuration Values

**Connection and Error Handling:**
- `LOG_THRESHOLD_FOR_CONNLOST_WRITES` (L8): Threshold for logging warnings after connection loss
- `ACCEPT_RETRY_DELAY` (L11): Delay in seconds before retrying failed accept() calls

**SSL/TLS Configuration:**
- `SSL_HANDSHAKE_TIMEOUT` (L20): 60-second timeout for SSL handshake completion
- `SSL_SHUTDOWN_TIMEOUT` (L24): 30-second timeout for SSL connection shutdown
- `FLOW_CONTROL_HIGH_WATER_SSL_READ` (L30): 256 KiB high water mark for SSL read operations
- `FLOW_CONTROL_HIGH_WATER_SSL_WRITE` (L31): 512 KiB high water mark for SSL write operations

**File Transfer and Threading:**
- `SENDFILE_FALLBACK_READBUFFER_SIZE` (L28): 256 KiB buffer size for sendfile fallback operations
- `THREAD_JOIN_TIMEOUT` (L34): 300-second timeout for joining threadpool threads

**Debug Configuration:**
- `DEBUG_STACK_DEPTH` (L16): Stack trace depth limit for debug mode operations

## Key Enumerations
- `_SendfileMode` (L38-41): Enum defining sendfile operation modes with values UNSUPPORTED, TRY_NATIVE, and FALLBACK

## Dependencies
- Standard library `enum` module for enumeration support

## Architectural Notes
- File contains code derived from uvloop project with dual licensing (PSF-2.0 AND MIT OR Apache-2.0)
- Designed to break circular dependencies between base_events and sslproto modules
- Values are tuned based on industry standards (e.g., SSL timeout matching Nginx defaults)