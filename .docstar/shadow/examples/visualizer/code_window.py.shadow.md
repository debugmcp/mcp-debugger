# examples/visualizer/code_window.py
@source-hash: b6d4f761772c5ac7
@generated: 2026-02-09T18:15:01Z

## CodeWindow - Dynamic Code File Viewer

**Primary Purpose**: Provides a sliding window view of source code files for debugger visualization, maintaining a ~20-line viewport that follows execution flow with smooth scrolling behavior.

### Core Class

**CodeWindow (L16-259)**: Main class managing dynamic code windows with caching and smooth scrolling.

**Key Constructor Parameters**:
- `window_size` (L19): Number of lines in viewport (default 20)
- `file_cache` (L27): Dict caching loaded file contents by normalized path
- `_last_window_params` (L28): Tuple tracking previous window state for smooth transitions

### Primary Methods

**get_window() (L30-90)**: Core method returning formatted code window
- **Input**: file_path, focus_line (1-based), optional breakpoints set, current_line
- **Output**: Tuple of (formatted_lines_with_markers, start_line, end_line)
- **Features**: Handles file loading, window calculation, marker insertion
- **Error Handling**: Returns error window on file access failures

**_load_file() (L92-127)**: Robust file loading with encoding fallback
- **Strategy**: Tries utf-8, latin-1, cp1252, then binary with error replacement
- **Caching**: Stores lines in file_cache for reuse
- **Error Resilience**: Returns None on any file access failure

**_calculate_window_bounds() (L129-184)**: Smart window positioning algorithm
- **Centering Logic**: Places focus_line at window center when possible
- **Boundary Handling**: Adjusts window when near file start/end
- **Smooth Scrolling**: Maintains stable window unless focus approaches edges (3-line margin)
- **State Tracking**: Uses _last_window_params to avoid jarring jumps

**_build_markers() (L186-211)**: Visual marker generation
- **Breakpoint Marker**: "●" for lines in breakpoints set
- **Current Line Marker**: "→" for currently executing line
- **Format**: Returns 2-character string for consistent alignment

### Utility Methods

**clear_cache() (L225-241)**: Cache management with optional file-specific clearing
**invalidate_file() (L243-250)**: Forces reload of specific file (delegates to clear_cache)
**get_cached_files() (L252-259)**: Returns list of currently cached file paths

### Dependencies

- **pathlib.Path**: For path normalization and resolution
- **typing**: Comprehensive type hints for List, Tuple, Optional, Set, Dict
- **os**: Standard library import (though not actively used in code)

### Architectural Patterns

**Caching Strategy**: File contents cached by normalized absolute path to avoid redundant I/O
**Error Resilience**: Multiple fallback mechanisms for encoding issues and file access failures  
**Smooth UX**: Edge-margin-based scrolling prevents jarring window jumps during execution flow
**Separation of Concerns**: Distinct methods for file loading, window calculation, and marker formatting

### Key Invariants

- Line numbers are 1-based in public interface
- Window size maintained unless constrained by file boundaries
- Path normalization ensures consistent cache keys
- Marker string always exactly 2 characters for alignment