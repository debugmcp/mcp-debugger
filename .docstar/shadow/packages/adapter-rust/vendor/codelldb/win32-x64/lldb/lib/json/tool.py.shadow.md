# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/json/tool.py
@source-hash: d5174b728b376a12
@generated: 2026-02-09T18:11:08Z

## Purpose
Command-line JSON validation and pretty-printing tool implementing Python's `json.tool` module functionality. Provides formatted JSON output with customizable indentation, sorting, and encoding options.

## Key Components

### Main Function (L19-78)
- **`main()`**: Core CLI handler that parses arguments, processes JSON input, and writes formatted output
- Creates ArgumentParser with comprehensive option set for JSON formatting control
- Handles both standard JSON and JSON Lines format parsing
- Implements file I/O with proper context management and error handling

### Argument Configuration (L23-51)
- **Input/Output**: `infile` (stdin default), `outfile` (stdout default) 
- **Formatting Options**: `--sort-keys`, `--no-ensure-ascii`, `--json-lines`
- **Indentation Group** (mutually exclusive): `--indent` (4 spaces default), `--tab`, `--no-indent`, `--compact`

### Processing Logic (L62-78)
- **JSON Lines Support** (L64-67): Parses line-by-line vs single object based on `--json-lines` flag
- **Output Generation** (L74-76): Applies formatting options via `json.dump()` with constructed `dump_args`
- **Error Handling** (L77-78): Converts JSON ValueError to SystemExit for clean CLI termination

## Dependencies
- `argparse`: CLI argument parsing
- `json`: JSON processing and formatting
- `sys`: Standard I/O streams and exit handling  
- `pathlib.Path`: Modern file path handling for output files

## Entry Point (L81-85)
- **`if __name__ == '__main__'`**: Direct execution handler with BrokenPipeError handling for pipe operations
- Graceful pipe termination with proper exit codes

## Key Behaviors
- Defaults to 4-space indentation with ASCII escaping enabled
- Supports streaming JSON Lines format for large datasets
- Maintains JSON validity while providing human-readable formatting
- Robust error reporting for malformed JSON input