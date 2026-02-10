# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tty.py
@source-hash: 1ab5e5e047130b31
@generated: 2026-02-09T18:10:12Z

## Purpose and Responsibility
Terminal utilities module providing functions to configure terminal modes for raw and cbreak input processing. Part of Python standard library's terminal interface layer, wrapping low-level termios operations for common terminal configuration patterns.

## Key Components

### Constants (L10-16)
- **Termios list indices**: IFLAG, OFLAG, CFLAG, LFLAG, ISPEED, OSPEED, CC - define positions in termios attribute arrays for input flags, output flags, control flags, local flags, input speed, output speed, and control characters respectively.

### Core Functions

**cfmakeraw(mode) (L18-44)**
- Configures termios mode for raw terminal input
- Disables all POSIX.1-2017 input processing flags (L23-24)
- Disables output post-processing (L27)
- Sets 8-bit character size, disables parity (L31-32)
- Clears local mode flags (echo, canonical mode, signals) (L35-36)
- Sets non-canonical mode with MIN=1, TIME=0 for blocking single-character reads (L42-44)

**cfmakecbreak(mode) (L46-57)**
- Configures termios mode for cbreak input (less aggressive than raw)
- Only disables echo and canonical input processing (L49)
- Preserves signal handling and other terminal features
- Sets same non-canonical blocking behavior as raw mode (L55-57)

**setraw(fd, when=TCSAFLUSH) (L59-65)**
- High-level interface to put terminal file descriptor into raw mode
- Gets current attributes, applies cfmakeraw transformation, sets new attributes
- Returns original mode for restoration
- Uses TCSAFLUSH by default to flush I/O before applying changes

**setcbreak(fd, when=TCSAFLUSH) (L67-73)**
- High-level interface to put terminal into cbreak mode
- Similar pattern to setraw but applies cfmakecbreak transformation
- Returns original mode for restoration

## Dependencies
- **termios module**: All termios constants and functions (tcgetattr, tcsetattr) imported via wildcard (L5)

## Architectural Patterns
- **Two-tier API**: Low-level mode configuration functions (cfmake*) and high-level terminal control functions (set*)
- **State preservation**: Both setraw/setcbreak return original terminal state for cleanup
- **POSIX compliance**: Strictly follows POSIX.1-2017 terminal interface specifications
- **Immutable transformations**: Functions create new mode lists rather than modifying in-place

## Critical Invariants
- Mode parameter must be valid termios attribute list with 7 elements
- File descriptor must refer to terminal device
- Non-canonical mode always configured with MIN=1, TIME=0 for consistent blocking behavior
- CC array converted to mutable list before modification