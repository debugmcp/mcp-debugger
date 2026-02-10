# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/logging/config.py
@source-hash: 07a479e9eb421e86
@generated: 2026-02-09T18:11:19Z

**Purpose**: Python logging configuration module providing file-based and dictionary-based configuration, plus network configuration listener capabilities. Part of the standard library logging package.

**Key Components**:

## Configuration Functions
- `fileConfig()` (L53-95): Parses ConfigParser-format files to configure logging system. Handles file validation, creates formatters/handlers/loggers with thread-safe locking.
- `dictConfig()` (L940-942): Main entry point for dictionary-based logging configuration using `DictConfigurator`.

## Core Classes

### Configuration Infrastructure
- `BaseConfigurator` (L372-502): Base class providing object resolution, conversion patterns, and custom factory configuration. Handles protocol-based conversions (ext://, cfg://) and dynamic object instantiation.
- `DictConfigurator` (L530-937): Primary configuration engine. Implements full logging setup from dictionary specs including formatters, filters, handlers, and loggers. Supports incremental updates.

### Converting Containers
- `ConvertingMixin` (L307-329): Provides value conversion capabilities for container classes
- `ConvertingDict` (L340-354): Dictionary wrapper with automatic value conversion on access
- `ConvertingList` (L355-364): List wrapper with conversion support  
- `ConvertingTuple` (L365-371): Tuple wrapper with conversion (read-only)

### Network Configuration Server
- `ConfigStreamHandler` (L965-1010): Socket request handler that processes logging configuration data via TCP. Supports both JSON dictionary and ConfigParser formats.
- `ConfigSocketReceiver` (L1011-1041): Threading TCP server for remote logging configuration
- `Server` (L1042-1064): Thread wrapper for the configuration server

## Key Helper Functions
- `_resolve()` (L97-109): Resolves dotted module/attribute names to Python objects
- `_create_formatters()` (L114-141): Creates formatter objects from config sections
- `_install_handlers()` (L143-179): Instantiates and configures handler objects with inter-handler reference resolution
- `_install_loggers()` (L203-287): Sets up logger hierarchy while preserving existing logger references
- `_handle_existing_loggers()` (L181-201): Manages existing loggers during reconfiguration
- `_clearExistingHandlers()` (L290-294): Safely clears and shuts down existing handlers

## Network Listener API
- `listen()` (L945-1065): Starts TCP server for remote configuration updates on specified port
- `stopListening()` (L1067-1078): Stops the configuration listener server

## Configuration Patterns
- Supports both incremental and full configuration modes
- Thread-safe operations using `logging._acquireLock()`
- Handles circular references in handler configurations with deferred setup
- Preserves existing logger objects to prevent breaking thread references
- Protocol-based value conversion (ext:// for imports, cfg:// for config references)

**Dependencies**: configparser, logging, socketserver, threading, queue, io, json, select

**Architecture Notes**:
- Uses factory pattern for object instantiation with eval() for dynamic configuration
- Implements two-pass handler configuration to resolve inter-handler dependencies
- Maintains backward compatibility with older Python parameter names (fmt vs format, strm vs stream)
- Network protocol uses struct-packed 4-byte length prefix followed by UTF-8 configuration data