# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pipes.py
@source-hash: 153f2d249d954b55
@generated: 2026-02-09T18:07:14Z

## Purpose
A deprecated Python module for creating shell command pipelines with automatic temporary file management. Provides template-based conversion workflows that handle intermediate files transparently. Marked for removal in Python 3.13.

## Core Architecture
The module uses a pipeline template pattern where conversion steps are chained together with automatic intermediate file handling. Each step is characterized by input/output types (stdin/stdout vs files).

## Key Classes

### Template (L85-182)
Main pipeline template class that manages conversion steps and execution.

**Key Methods:**
- `__init__()` (L88): Initializes empty pipeline with debugging disabled
- `append(cmd, kind)` (L113): Adds conversion step at end with validation
- `prepend(cmd, kind)` (L129): Adds conversion step at beginning with validation  
- `open(file, rw)` (L145): Opens file through pipeline for reading/writing
- `copy(infile, outfile)` (L173): Executes complete pipeline conversion
- `makepipeline(infile, outfile)` (L176): Builds shell command string
- `clone()` (L101): Creates independent copy of template

**Internal State:**
- `steps`: List of (command, kind) tuples representing pipeline stages
- `debugging`: Flag to enable shell command tracing

## Key Functions

### makepipeline(infile, steps, outfile) (L184-250)
Core pipeline construction algorithm that:
1. Builds intermediate command list with placeholders
2. Handles input/output file requirements
3. Creates temporary files for file-based step connections
4. Generates shell script with proper quoting and cleanup

## Step Types (L72-82)
Pipeline step classification system:
- `FILEIN_FILEOUT` ('ff'): Requires real input and output files
- `STDIN_FILEOUT` ('-f'): Reads stdin, writes file
- `FILEIN_STDOUT` ('f-'): Reads file, writes stdout
- `STDIN_STDOUT` ('--'): Standard pipeline element
- `SOURCE` ('.-'): Must be first step, generates output
- `SINK` ('-.`)`: Must be last step, consumes input

## Dependencies
- `os`: System command execution and file operations
- `tempfile`: Automatic temporary file creation
- `shlex.quote`: Shell-safe command argument escaping
- `re`: Pattern matching for $IN/$OUT variable validation
- `warnings`: Deprecation notice handling

## Architecture Patterns
- Template Method: Pipeline construction follows fixed algorithm with customizable steps
- Command Pattern: Each pipeline step encapsulates shell command with metadata
- Automatic Resource Management: Temporary files are created and cleaned up transparently
- Validation: Strict checking of step types and required variables

## Critical Constraints
- Commands requiring file input must contain `$IN` variable
- Commands requiring file output must contain `$OUT` variable  
- SOURCE steps can only be prepended, SINK steps can only be appended
- Pipeline cannot end with SINK for reading or begin with SOURCE for writing
- All commands must be valid `/bin/sh` syntax

## Security Considerations
Uses `shlex.quote` for shell injection protection, but still executes arbitrary shell commands via `os.system` and `os.popen`.