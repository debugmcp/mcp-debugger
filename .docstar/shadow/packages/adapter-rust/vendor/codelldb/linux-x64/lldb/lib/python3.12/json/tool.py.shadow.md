# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/json/tool.py
@source-hash: d5174b728b376a12
@generated: 2026-02-09T18:06:13Z

## Purpose
Command-line tool implementation for the `json.tool` module that validates and pretty-prints JSON data. Provides a simple CLI interface to Python's json module with various formatting options.

## Key Functions

**main() (L19-78)**
- Primary entry point that sets up argument parsing and handles JSON processing
- Configures argparse with input/output file handling and formatting options
- Supports both standard JSON and JSON Lines format processing
- Handles file I/O with proper encoding (UTF-8) and error management
- Raises SystemExit on ValueError to provide clean error messages

## Command-Line Interface

**Argument Configuration (L24-51)**
- `infile`: Optional input file (defaults to stdin), FileType with UTF-8 encoding
- `outfile`: Optional output file as Path object (defaults to stdout)
- `--sort-keys`: Boolean flag for alphabetical key sorting
- `--no-ensure-ascii`: Disables ASCII escaping for non-ASCII characters
- `--json-lines`: Enables JSON Lines format processing
- Mutually exclusive formatting group:
  - `--indent`: Number of spaces for indentation (default: 4)
  - `--tab`: Use tab characters for indentation
  - `--no-indent`: No newlines, space-separated
  - `--compact`: Minimal whitespace formatting

## Core Processing Logic

**JSON Processing (L62-78)**
- Context manager pattern for file handling
- Conditional processing based on `--json-lines` flag:
  - JSON Lines: Generator parsing each line individually (L65)
  - Standard: Single JSON object loading (L67)
- Dynamic dump arguments configuration based on CLI options (L53-60)
- Output writing with newline termination for each object (L76)

## Dependencies
- `argparse`: Command-line argument parsing
- `json`: Core JSON processing functionality
- `sys`: Standard streams and exit handling
- `pathlib.Path`: Modern file path handling

## Entry Point
**Module execution (L81-85)**
- Standard `if __name__ == '__main__'` pattern
- BrokenPipeError handling for clean pipe termination

## Architecture Notes
- Clean separation between argument parsing and JSON processing
- Generator-based approach for memory-efficient JSON Lines processing
- Consistent error handling with appropriate exit codes
- UTF-8 encoding enforced throughout for proper Unicode support