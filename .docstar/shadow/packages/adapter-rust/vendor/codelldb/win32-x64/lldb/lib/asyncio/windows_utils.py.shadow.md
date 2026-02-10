# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/windows_utils.py
@source-hash: e6fcffefa2521666
@generated: 2026-02-09T18:10:28Z

## Purpose
Windows-specific utilities for asyncio providing overlapped pipe handles and subprocess operations. Designed to work with IOCP (I/O Completion Ports) event loops on Windows platforms.

## Key Components

### Module Setup (L1-18)
- Platform guard: Only imports on Windows (L5-6), raises ImportError otherwise
- Exports: `pipe`, `Popen`, `PIPE`, `PipeHandle` (L17)
- Dependencies: `_winapi`, `msvcrt`, `subprocess`, `tempfile` for Windows API operations

### Constants & Globals (L20-26)
- `BUFSIZE = 8192`: Default buffer size for pipes
- `PIPE`, `STDOUT`: Re-exported from subprocess
- `_mmap_counter`: Iterator for generating unique pipe names

### Core Functions

#### `pipe()` (L32-75)
Creates Windows named pipes with overlapped I/O support. Key parameters:
- `duplex`: Controls bidirectional vs unidirectional pipes
- `overlapped`: Tuple controlling overlapped flags for each handle
- `bufsize`: Buffer size configuration

Creates unique pipe address using PID and counter (L34-36). Handles both duplex and simplex configurations with appropriate access rights and buffer sizes.

### Classes

#### `PipeHandle` (L81-119)
Wrapper for Windows pipe handles providing file-like interface:
- `__init__(handle)` (L86): Stores Windows handle
- `handle` property (L96-98): Exposes underlying handle
- `fileno()` (L100-103): Returns handle for compatibility
- `close()` (L105-108): Properly closes Windows handle
- `__del__()` (L110-113): Resource cleanup with warning for unclosed handles
- Context manager support (L115-119)

#### `Popen` (L125-173)
Subprocess.Popen replacement using overlapped pipe handles:
- Inherits from `subprocess.Popen` but replaces stdio with `PipeHandle` instances
- `__init__()` (L130-173): Complex initialization handling stdin/stdout/stderr pipes
- Creates overlapped pipes for PIPE arguments (L135-151)
- Converts handles to file descriptors for subprocess, then wraps results in PipeHandle
- Proper cleanup in exception cases (L155-159)

## Architecture Patterns
- **Resource Management**: Explicit handle cleanup with try/except blocks and context managers
- **Platform Abstraction**: Windows-specific implementation of cross-platform pipe interface  
- **IOCP Integration**: Overlapped I/O support for Windows event loop compatibility
- **Handle/FD Conversion**: Bridges Windows handles and POSIX file descriptors for subprocess compatibility

## Critical Constraints
- Windows-only module (enforced at import)
- Overlapped I/O requires careful buffer size and flag management
- Handle lifecycle management critical to prevent resource leaks
- File descriptor cleanup required in finally blocks (L167-173)