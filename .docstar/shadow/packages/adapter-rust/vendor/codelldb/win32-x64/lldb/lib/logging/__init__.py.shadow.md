# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/logging/__init__.py
@source-hash: 43f86bbc08fdd5c7
@generated: 2026-02-09T18:11:32Z

This is the core Python logging module's `__init__.py` - the main entry point providing a complete hierarchical logging framework. It implements PEP 282 and serves as the foundation for Python's standard logging system.

## Primary Purpose
Provides a flexible, hierarchical logging system with configurable handlers, formatters, and filters. Supports multiple output destinations, formatting styles, and thread-safe operation.

## Key Classes and Components

### Level Management (L98-124)
- **Logging levels**: `CRITICAL=50`, `ERROR=40`, `WARNING=30`, `INFO=20`, `DEBUG=10`, `NOTSET=0`
- **`getLevelName(level)`** (L129-154): Converts between numeric and string level representations
- **`addLevelName(level, levelName)`** (L156-167): Associates custom level names with numeric values

### Log Records
- **`LogRecord`** (L286-394): Core data structure representing a logging event
  - Contains message, level, timestamp, caller info, thread/process details
  - **`getMessage()`** (L383-393): Formats message with arguments using `%` formatting
- **`_logRecordFactory`** (L398): Global factory for creating LogRecord instances
- **`makeLogRecord(dict)`** (L417-426): Creates LogRecord from dictionary (for deserialization)

### Formatting System (L436-764)
- **`PercentStyle`** (L436-467): Handles `%(name)s` format strings
- **`StrFormatStyle`** (L469-501): Handles `{name}` format strings  
- **`StringTemplateStyle`** (L503-536): Handles `${name}` template strings
- **`Formatter`** (L546-721): Main formatting class
  - **`format(record)`** (L690-720): Primary formatting method
  - **`formatTime(record, datefmt=None)`** (L622-647): Time formatting with configurable converter
- **`BufferingFormatter`** (L727-763): Formats collections of records

### Filtering System (L769-865)
- **`Filter`** (L769-804): Hierarchical name-based filtering
- **`Filterer`** (L806-865): Base class providing filter management for loggers/handlers

### Handler System (L871-1305)
- **`Handler`** (L919-1116): Abstract base class for all log destinations
  - **`emit(record)`** (L1001-1009): Abstract method for outputting records
  - **`handle(record)`** (L1011-1031): Coordinates filtering, formatting, and output
  - **`handleError(record)`** (L1066-1111): Error handling during emission
- **`StreamHandler`** (L1117-1200): Writes to streams (stdout/stderr)
- **`FileHandler`** (L1202-1285): Writes to files with encoding support
- **`NullHandler`** (L2285-2305): No-op handler to suppress "no handlers" warnings

### Logger Hierarchy (L1482-2012)
- **`Logger`** (L1482-1859): Main logging interface
  - **Logging methods**: `debug()`, `info()`, `warning()`, `error()`, `critical()` (L1517-1592)
  - **`_log(level, msg, args, ...)`** (L1660-1684): Core logging implementation
  - **`findCaller(stack_info=False, stacklevel=1)`** (L1611-1643): Stack introspection for caller info
  - **`isEnabledFor(level)`** (L1790-1810): Level checking with caching
  - **`callHandlers(record)`** (L1746-1774): Propagates records up hierarchy
- **`RootLogger`** (L1861-1875): Special singleton root logger
- **`LoggerAdapter`** (L1878-2012): Wrapper adding contextual information
- **`Manager`** (L1353-1477): Manages logger hierarchy and creation

### Module-Level Interface (L2149-2278)
- **`getLogger(name=None)`** (L2149-2157): Primary logger factory function
- **Convenience functions**: `debug()`, `info()`, `warning()`, `error()`, `critical()` (L2159-2226)
- **`basicConfig(**kwargs)`** (L2021-2142): One-shot configuration for simple use cases
- **`disable(level=CRITICAL)`** (L2238-2243): Globally disable logging below specified level
- **`shutdown(handlerList=_handlerList)`** (L2245-2277): Cleanup at application exit

### Thread Safety (L232-279)
- **`_lock`** (L232): Module-level RLock for thread synchronization
- **`_acquireLock()/_releaseLock()`** (L234-248): Lock management functions
- **Fork handling** (L253-279): Reinitializes locks after os.fork() on Unix systems

### Global State
- **`root`** (L2013): Singleton root logger instance
- **`_startTime`** (L59): Module load timestamp for relative timing
- **Configuration flags**: `raiseExceptions`, `logThreads`, `logMultiprocessing`, `logProcesses`, `logAsyncioTasks` (L65-85)

## Key Patterns
- **Factory pattern**: Configurable LogRecord and Logger factories
- **Chain of responsibility**: Handler and filter chains
- **Hierarchical naming**: Dot-separated logger names with inheritance
- **Template method**: Formatter style classes with pluggable formatting logic
- **Singleton**: Root logger and manager instances

## Critical Invariants
- Logger hierarchy maintained via Manager.loggerDict
- Thread safety via module-level RLock
- Level inheritance from parent loggers when level=NOTSET
- Handler list processed in order, with propagation up hierarchy
- LogRecord attributes populated consistently across all creation paths