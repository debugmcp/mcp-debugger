# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/log.py
@source-hash: 80e4cc3ded4b138b
@generated: 2026-02-09T18:11:15Z

**Purpose:** Simple logging configuration module that establishes a package-scoped logger for the asyncio package.

**Key Elements:**
- `logger` (L7): Package-scoped logger instance created using `logging.getLogger(__package__)`, following Python logging best practices by naming the logger after its containing package

**Dependencies:**
- `logging`: Standard library module for logging functionality

**Architecture:**
- Minimal configuration approach - creates a single logger instance without custom handlers or formatters
- Uses `__package__` to automatically derive logger name from package hierarchy
- Follows convention of defining package logger at module level for import by other modules

**Usage Pattern:**
This module serves as a centralized logging entry point for the asyncio package. Other modules would typically import this logger rather than creating their own instances, ensuring consistent logging hierarchy and configuration.