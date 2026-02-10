# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pipes.py
@source-hash: 153f2d249d954b55
@generated: 2026-02-09T18:08:59Z

## Purpose
Provides a deprecated pipeline template system for converting data through multiple command-line steps, handling temporary files and shell command orchestration automatically. This is part of Python's legacy modules scheduled for removal in Python 3.13.

## Key Classes

### Template (L85-182)
Main class for building and executing command pipelines.

**Initialization & State:**
- `__init__` (L88-91): Creates empty pipeline with debugging disabled
- `reset` (L97-99): Clears all pipeline steps
- `clone` (L101-107): Creates deep copy of template
- `debugging` attribute: Controls verbose shell execution output

**Pipeline Building:**
- `append(cmd, kind)` (L113-127): Adds command step to end of pipeline
- `prepend(cmd, kind)` (L129-143): Adds command step to beginning of pipeline
- Validates command strings contain required `$IN`/`$OUT` placeholders based on kind
- Enforces SOURCE-only-first and SINK-only-last constraints

**Execution:**
- `copy(infile, outfile)` (L173-174): Executes complete pipeline, returns exit status
- `open(file, rw)` (L145-153): Opens pipeline as file-like object for reading/writing
- `makepipeline(infile, outfile)` (L176-181): Generates shell command string

## Key Functions

### makepipeline (L184-250)
Core pipeline construction logic that:
- Converts step list into executable shell commands (L188-190)
- Handles input/output file connections (L199-207) 
- Creates temporary files for inter-step communication (L211-219)
- Builds shell command with proper quoting and redirection (L221-241)
- Adds cleanup trap for temporary files (L243-248)

## Constants & Types

**Step Kinds (L74-82):**
- `FILEIN_FILEOUT ('ff')`: Requires real files for input and output
- `STDIN_FILEOUT ('-f')`: Reads stdin, writes to file  
- `FILEIN_STDOUT ('f-')`: Reads file, writes to stdout
- `STDIN_STDOUT ('--')`: Normal pipeline element
- `SOURCE ('.-')`: Pipeline source (must be first)
- `SINK ('-.')`: Pipeline sink (must be last)

## Dependencies
- `re`: Pattern matching for `$IN`/`$OUT` validation
- `os`: System calls and process execution via `popen`/`system`
- `tempfile`: Temporary file creation for inter-step communication
- `shlex.quote`: Shell-safe argument quoting
- `warnings`: Deprecation notice handling

## Architecture Notes
- Uses shell command strings with variable substitution (`$IN`, `$OUT`)
- Automatically manages temporary files between incompatible pipeline steps
- Provides both file-copy and streaming interfaces
- Shell-based execution with proper signal handling and cleanup
- Backward compatibility maintained through selective import of `shlex.quote`

## Critical Constraints
- Commands must be valid `/bin/sh` syntax
- File-type steps require corresponding `$IN`/`$OUT` placeholders
- SOURCE steps can only be prepended, SINK steps can only be appended
- Pipeline cannot start with SINK or end with SOURCE for streaming operations