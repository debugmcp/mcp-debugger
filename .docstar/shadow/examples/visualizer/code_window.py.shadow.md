# examples/visualizer/code_window.py
@source-hash: b6d4f761772c5ac7
@generated: 2026-02-10T00:41:44Z

## CodeWindow - Dynamic Code Window Management

**Primary Purpose**: Provides a sliding window view of source code files for debugger visualization, showing ~20 lines around points of interest with execution tracking and visual markers.

### Core Class
- **CodeWindow (L16-259)**: Main class managing sliding window views of code files
  - `__init__(window_size=20) (L19-28)`: Initializes with configurable window size, file cache, and window state tracking
  - File cache (`file_cache`) stores loaded files to avoid repeated I/O
  - Window state (`_last_window_params`) enables smooth scrolling transitions

### Key Methods

**Window Generation**:
- `get_window() (L30-90)`: Core method returning formatted code window with markers
  - Takes file path, focus line, breakpoints set, current execution line
  - Returns tuple: (formatted_lines, start_line, end_line)
  - Handles file loading, window calculation, and marker application

**File Management**:
- `_load_file() (L92-127)`: Robust file loading with multiple encoding fallbacks
  - Tries UTF-8, Latin-1, CP1252 encodings sequentially
  - Falls back to binary mode with error replacement for problematic files
  - Caches loaded content for performance
- `clear_cache() (L225-241)`: Clears file cache selectively or completely
- `invalidate_file() (L243-250)`: Forces file reload on next access
- `get_cached_files() (L252-259)`: Returns list of cached file paths

**Window Positioning**:
- `_calculate_window_bounds() (L129-184)`: Implements smooth scrolling algorithm
  - Centers window on focus line when possible
  - Handles file boundary constraints
  - Maintains window stability with edge-triggered scrolling (3-line margin)
  - Per-file window state tracking for multi-file debugging

**Visual Formatting**:
- `_build_markers() (L186-211)`: Creates 2-character marker prefix
  - First char: breakpoint indicator (● or space)
  - Second char: current line indicator (→ or space)
- `_error_window() (L213-223)`: Creates error display for file access failures

### Dependencies
- Standard library: `typing`, `os`, `pathlib`
- Uses `Path` for cross-platform file path normalization

### Key Features
- **Smooth scrolling**: Window stays stable unless focus moves near edges
- **Multi-file support**: Per-file window state and caching
- **Robust encoding**: Handles various text encodings gracefully  
- **Visual markers**: Breakpoints and execution position indicators
- **Performance**: File caching minimizes I/O operations

### Architecture Patterns
- Cache-first design with fallback loading
- Stateful window management for smooth UX
- Error-resilient file handling with graceful degradation
- Immutable return values (tuples) for predictable API