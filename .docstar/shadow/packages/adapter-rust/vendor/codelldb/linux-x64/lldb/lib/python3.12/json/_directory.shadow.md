# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/json/
@generated: 2026-02-09T18:16:12Z

## JSON Module - Python Standard Library Implementation

This directory contains core components of Python's standard `json` module, providing both programmatic JSON processing capabilities and command-line tooling for JSON manipulation.

## Overall Purpose

The module serves dual purposes:
1. **Core JSON Processing**: Low-level tokenization and parsing infrastructure for converting JSON strings into Python objects
2. **Command-Line Interface**: User-facing tool for validating, formatting, and processing JSON data from the command line

## Key Components and Relationships

### JSON Parsing Engine (`scanner.py`)
- **Core Responsibility**: Tokenization and recursive parsing of JSON strings
- **Architecture**: Factory pattern creating context-aware scanner functions with closure-based design
- **Performance Strategy**: C extension fallback (`_json.c_make_scanner`) with pure Python implementation as backup
- **Token Processing**: Character-by-character scanning with dedicated handlers for each JSON token type (strings, numbers, objects, arrays, literals)

### Command-Line Tool (`tool.py`)
- **Core Responsibility**: CLI interface for JSON validation and pretty-printing
- **Integration**: Leverages the parsing infrastructure for processing user input
- **Format Support**: Both standard JSON and JSON Lines format processing
- **Output Control**: Comprehensive formatting options (indentation, sorting, ASCII handling)

## Public API Surface

### Programmatic Interface
- `py_make_scanner(context)`: Factory function for creating JSON scanners
- `scan_once(string, idx)`: Public tokenizer that parses next JSON token at given index
- Scanner functions return `(parsed_value, next_index)` tuples for state management

### Command-Line Interface
- **Entry Point**: `python -m json.tool [options] [infile] [outfile]`
- **Key Options**:
  - `--sort-keys`: Alphabetical key ordering
  - `--indent N`: Indentation control
  - `--json-lines`: JSON Lines format support
  - `--compact`: Minimal whitespace output

## Internal Organization and Data Flow

### Parsing Flow
1. **Scanner Creation**: Context object with parsing functions → Factory creates specialized scanner
2. **Token Recognition**: Character inspection → Token type identification → Appropriate parser delegation  
3. **Recursive Processing**: Objects/arrays trigger recursive scanning with memo management
4. **State Management**: Each parse operation returns value + next position for continuation

### CLI Processing Flow
1. **Argument Parsing**: Command-line options → Configuration object
2. **Input Processing**: File/stdin → JSON parsing (single object or JSON Lines)
3. **Output Formatting**: Parsed data → Configured formatting → File/stdout

## Important Patterns and Conventions

### Error Handling
- `StopIteration` exceptions signal end-of-input and parse errors
- `SystemExit` on `ValueError` for clean CLI error reporting
- Comprehensive bounds checking during token parsing

### Performance Optimizations
- C extension preference with Python fallback
- Closure-based scanners avoid parameter passing overhead
- Automatic memoization clearing prevents memory leaks
- Generator-based JSON Lines processing for memory efficiency

### Code Organization
- Factory pattern for scanner creation enables context customization
- Mutual exclusion groups in CLI prevent conflicting formatting options
- UTF-8 encoding enforced throughout for Unicode compliance

This module represents a complete JSON processing ecosystem, from low-level parsing primitives to high-level user tools, designed for both embedded use in Python applications and standalone command-line JSON processing tasks.