# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/pipes.py
@source-hash: 153f2d249d954b55
@generated: 2026-02-09T18:14:27Z

## Primary Purpose
Pipeline template system for shell command conversion pipelines. Constructs and executes complex data transformation workflows by chaining shell commands with automatic temporary file management. Part of Python standard library (deprecated, removal in 3.13).

## Core Classes

### Template (L85-182)
Main pipeline template class managing conversion step sequences.

**Key Methods:**
- `__init__()` (L88-91): Initializes empty pipeline with debugging disabled
- `append(cmd, kind)` (L113-127): Adds conversion step to end with validation
- `prepend(cmd, kind)` (L129-143): Adds conversion step to beginning with validation  
- `open(file, rw)` (L145-153): Opens file through pipeline for reading/writing
- `open_r(file)` (L155-163): Opens pipeline for reading, returns popen object
- `open_w(file)` (L165-171): Opens pipeline for writing, returns popen object
- `copy(infile, outfile)` (L173-174): Executes full pipeline transformation
- `clone()` (L101-107): Creates deep copy of template
- `reset()` (L97-99): Clears all pipeline steps
- `debug(flag)` (L109-111): Enables/disables shell command debugging
- `makepipeline(infile, outfile)` (L176-181): Generates shell command string

**State:**
- `steps`: List of (command, kind) tuples defining pipeline
- `debugging`: Boolean flag for shell debug output

## Pipeline Step Types (L72-82)
Constants defining I/O requirements for pipeline steps:
- `FILEIN_FILEOUT ('ff')`: Requires real files for input/output
- `STDIN_FILEOUT ('-f')`: Reads stdin, writes file  
- `FILEIN_STDOUT ('f-')`: Reads file, writes stdout
- `STDIN_STDOUT ('--')`: Standard pipeline element
- `SOURCE ('.-')`: Pipeline source (first step only)
- `SINK ('-.')`: Pipeline sink (last step only)

## Core Algorithm

### makepipeline(infile, steps, outfile) (L184-250)
Converts step list into executable shell pipeline:

1. **Step Processing (L188-190)**: Builds command list from steps
2. **Endpoint Handling (L199-207)**: Manages input/output file requirements
3. **Temporary Files (L211-219)**: Creates intermediate files using `tempfile.mkstemp()`
4. **Command Generation (L221-231)**: Builds shell commands with proper I/O redirection
5. **Pipeline Assembly (L233-241)**: Joins commands with pipes or newlines
6. **Cleanup Management (L243-248)**: Adds trap handlers for temporary file removal

## Dependencies
- `re`: Pattern matching for $IN/$OUT variable validation
- `os`: System calls (`os.popen`, `os.system`, `os.close`)
- `tempfile`: Temporary file creation (`mkstemp`)
- `shlex.quote`: Shell argument escaping
- `warnings`: Deprecation notice handling

## Key Patterns
- **Template Method**: `Template` class defines workflow, `makepipeline` implements execution
- **Command Validation**: Regex checks ensure $IN/$OUT variables present when required
- **Resource Management**: Automatic temporary file creation and cleanup via shell traps
- **Shell Abstraction**: Generates portable `/bin/sh` compatible command sequences

## Critical Invariants
- SOURCE steps can only be first in pipeline
- SINK steps can only be last in pipeline  
- Commands requiring files must contain $IN/$OUT variables
- Step kinds must be from predefined `stepkinds` list
- Temporary files automatically cleaned up via shell trap handlers