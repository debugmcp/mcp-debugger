# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/__main__.py
@source-hash: ff6b9a100d320017
@generated: 2026-02-09T18:11:10Z

**Primary Purpose**: Main entry point module for the unittest package that configures sys.argv for better help messages and delegates to the main unittest runner.

**Core Functionality**:
- Modifies `sys.argv[0]` (L4-11) to display a more user-friendly command in help messages when executed as `__main__.py`
- Sets `__unittest = True` flag (L14) to indicate unittest context
- Imports and delegates to `main()` function from `.main` module (L16-18)

**Key Components**:
- **argv modification logic** (L4-11): Detects when script is run via `__main__.py`, extracts executable basename, and reformats `sys.argv[0]` to show `executable -m unittest` format
- **Module cleanup** (L12): Removes `os` reference after use to avoid namespace pollution
- **Main delegation** (L18): Calls `main(module=None)` to start unittest execution

**Dependencies**:
- Standard library: `sys`, `os.path` (conditionally imported)
- Local: `.main.main` function

**Architectural Notes**:
- This is a typical Python `__main__.py` pattern for making packages executable via `-m` flag
- The argv manipulation improves user experience by showing meaningful command syntax in help output
- Clean namespace management with explicit cleanup of imported modules