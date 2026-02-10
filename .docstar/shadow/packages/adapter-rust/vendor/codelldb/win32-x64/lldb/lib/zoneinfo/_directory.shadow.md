# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/zoneinfo/
@generated: 2026-02-09T18:16:09Z

## Overall Purpose and Responsibility

This directory contains a complete Python implementation of timezone handling functionality, forming the core of Python's `zoneinfo` package. It provides comprehensive timezone-aware datetime operations using the IANA timezone database (tzdata), supporting both binary TZif file parsing and POSIX TZ string format processing.

## Key Components and Relationships

The module is architected around four core components that work together to provide robust timezone functionality:

### **__init__.py** - Public API Gateway
- Serves as the primary entry point, exposing the complete public interface
- Implements graceful fallback from C extension (`_zoneinfo`) to pure Python implementation
- Provides lazy loading for `TZPATH` configuration and module introspection

### **_zoneinfo.py** - Core Timezone Implementation
- Contains the main `ZoneInfo` class implementing Python's `tzinfo` protocol
- Features two-tier caching system (weak references + LRU) for performance optimization
- Handles complex DST transitions with fold detection and UTC/local time conversion
- Supports both binary tzdata files and POSIX TZ string formats through specialized classes (`_TZStr`, `_ttinfo`)

### **_common.py** - Binary Data Parser
- Provides low-level TZif binary format parsing capabilities
- Handles both TZif v1 (32-bit) and v2+ (64-bit) timezone file formats
- Implements `ZoneInfoNotFoundError` exception and tzdata package loading
- Offers memory-efficient parsing with lazy abbreviation loading and caching

### **_tzpath.py** - Path Management and Discovery
- Manages global `TZPATH` configuration for locating timezone data
- Provides security validation preventing directory traversal attacks
- Implements timezone discovery across system paths and tzdata packages
- Handles environment variable parsing (`PYTHONTZPATH`) with validation warnings

## Public API Surface

**Primary Entry Points:**
- `ZoneInfo(key)` - Main timezone class factory with caching
- `ZoneInfo.from_file(fobj, key=None)` - Create timezone from file object
- `ZoneInfo.no_cache(key)` - Create uncached timezone instance

**Configuration Management:**
- `reset_tzpath(to=None)` - Reset timezone search paths
- `available_timezones()` - Discover all available timezone identifiers
- `TZPATH` - Global tuple of timezone search paths

**Exception Handling:**
- `ZoneInfoNotFoundError` - Raised when timezone key lookup fails
- `InvalidTZPathWarning` - Warning for invalid timezone paths

## Internal Organization and Data Flow

1. **Initialization**: `__init__.py` attempts C extension import, falls back to pure Python, establishes module interface
2. **Path Resolution**: `_tzpath` manages TZPATH configuration from environment or sysconfig
3. **Data Loading**: `_common.load_tzdata()` locates timezone files, `load_data()` parses binary TZif format
4. **Timezone Construction**: `_zoneinfo.ZoneInfo` processes parsed data into timezone objects with transition handling
5. **Caching Strategy**: Two-tier system balances memory usage with lookup performance

## Important Patterns and Conventions

**Security-First Design**: Multiple validation layers prevent path traversal attacks and ensure absolute paths only

**Performance Optimization**: 
- LRU caching for timedelta objects (512 entries) and ZoneInfo instances (8 entries)
- Lazy loading for abbreviations and TZPATH configuration
- Weak reference caching to prevent memory leaks

**Robust Error Handling**: Comprehensive exception handling for missing files, invalid formats, and malformed data with descriptive error messages

**Format Compatibility**: Supports both legacy TZif v1 and modern v2+ formats, plus POSIX TZ string fallbacks for comprehensive timezone coverage

This module serves as a complete, self-contained timezone handling system that integrates seamlessly with Python's datetime infrastructure while maintaining high performance and security standards.