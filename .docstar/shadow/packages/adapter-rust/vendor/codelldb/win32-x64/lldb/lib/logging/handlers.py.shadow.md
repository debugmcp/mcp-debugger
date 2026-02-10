# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/logging/handlers.py
@source-hash: 898d5a38cbf79d70
@generated: 2026-02-09T18:11:30Z

Python logging handlers extension module providing specialized log output destinations and mechanisms beyond the core logging module.

## Core Infrastructure

**BaseRotatingHandler (L45-118)**: Abstract base class for file handlers that support rotation. Provides rotation framework with customizable `namer` and `rotator` callbacks. Key methods:
- `emit()` (L65): Checks for rollover before delegating to FileHandler
- `rotation_filename()` (L79): Applies custom naming via `namer` callback
- `rotate()` (L98): Performs file rotation via `rotator` callback or os.rename

## File Rotation Handlers

**RotatingFileHandler (L119-204)**: Size-based log rotation. Rotates when file reaches `maxBytes`, keeping `backupCount` backup files with `.1`, `.2`, etc. suffixes. `doRollover()` (L160) implements cascade renaming pattern.

**TimedRotatingFileHandler (L205-453)**: Time-based rotation supporting intervals: S(econds), M(inutes), H(ours), D(ays), midnight, W0-6(weekly). Complex `computeRollover()` (L280) handles DST transitions and scheduling. `getFilesToDelete()` (L376) uses regex matching for cleanup.

**WatchedFileHandler (L454-526)**: Unix-specific handler that monitors file inode/device changes (for logrotate compatibility). `reopenIfNeeded()` (L489) detects external rotation via stat comparison.

## Network Handlers

**SocketHandler (L528-694)**: TCP logging with automatic reconnection using exponential backoff. `makePickle()` (L630) serializes LogRecord.__dict__ with length prefix. Supports Unix domain sockets when port=None.

**DatagramHandler (L695-736)**: UDP variant of SocketHandler. Simpler since UDP is connectionless - no reconnection logic needed.

**SysLogHandler (L737-1015)**: RFC 3164/5424 syslog protocol handler. Extensive facility/priority constants (L756-843). Supports both Unix domain sockets and UDP/TCP network sockets with automatic fallback. `encodePriority()` (L936) implements syslog priority encoding.

## Email/Event Handlers

**SMTPHandler (L1016-1095)**: Sends log records via email using smtplib. Supports TLS and authentication. Each log record triggers separate email.

**NTEventLogHandler (L1096-1202)**: Windows Event Log integration via win32evtlog. Maps Python log levels to Windows event types. Requires pywin32 extensions.

**HTTPHandler (L1203-1292)**: Sends log records to web server via GET/POST. `mapLogRecord()` (L1228) converts LogRecord to CGI data format.

## Memory/Queue Handlers

**BufferingHandler (L1293-1349)**: Abstract base for memory buffering. Accumulates records until `shouldFlush()` returns True (default: capacity exceeded). Subclasses implement actual flushing logic.

**MemoryHandler (L1350-1425)**: Buffering with target handler. Flushes on capacity or severity threshold (`flushLevel`). `flushOnClose` parameter controls close-time behavior.

**QueueHandler (L1427-1499)**: Sends records to queue for inter-process logging. `prepare()` (L1456) formats and sanitizes records for pickling. Uses `put_nowait()` by default.

**QueueListener (L1501-1608)**: Companion class running background thread to consume queue and dispatch to handlers. `_monitor()` (L1565) implements the listening loop with sentinel-based termination.

## Constants and Configuration

- Network ports: TCP=9020, UDP=9021, HTTP=9022, SOAP=9023, SYSLOG=514 (L36-41)
- Time constants: `_MIDNIGHT = 86400` seconds (L43)
- Comprehensive syslog facility/priority mappings for Unix logging standards

## Key Patterns

- Rotation handlers use template method pattern with extension points for custom naming/rotation
- Network handlers implement automatic reconnection with exponential backoff
- All handlers follow Python logging.Handler protocol (emit/flush/close)
- Thread-safety via acquire/release locking where needed
- Graceful degradation when optional dependencies unavailable (win32evtlog, smtplib)