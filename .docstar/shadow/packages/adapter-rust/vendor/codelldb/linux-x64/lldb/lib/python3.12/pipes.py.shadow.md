# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pipes.py
@source-hash: 153f2d249d954b55
@generated: 2026-02-09T18:10:19Z

## Primary Purpose
Legacy shell pipeline composition module for converting data between formats through chained command-line tools. Creates reusable pipeline templates that handle temporary file management and command chaining. **Module is deprecated** (L68) and scheduled for removal in Python 3.13.

## Key Classes and Functions

### Template Class (L85-181)
Main pipeline builder class that chains shell commands with specified input/output modes.

**Constructor & State Management:**
- `__init__()` (L88-91): Initializes empty pipeline with debugging disabled
- `reset()` (L97-99): Clears all pipeline steps
- `clone()` (L101-107): Creates deep copy of template with same steps and debug setting

**Pipeline Construction:**
- `append(cmd, kind)` (L113-127): Adds command to end of pipeline
- `prepend(cmd, kind)` (L129-143): Adds command to beginning of pipeline
- Kind validation ensures proper SOURCE/SINK positioning and $IN/$OUT variable presence

**Execution Methods:**
- `copy(infile, outfile)` (L173-174): Executes pipeline via `os.system()`, returns exit status
- `open(file, rw)` (L145-153): Opens pipeline as file-like object for reading/writing
- `open_r(file)` (L155-163): Opens pipeline for reading via `os.popen()`
- `open_w(file)` (L165-171): Opens pipeline for writing via `os.popen()`
- `makepipeline(infile, outfile)` (L176-181): Generates shell command string with optional debug output

### Pipeline Generation Function
- `makepipeline(infile, steps, outfile)` (L184-250): Core algorithm that converts step list into executable shell pipeline
  - Handles temporary file creation/cleanup (L211-219)
  - Manages shell variable substitution ($IN/$OUT) (L224-226) 
  - Builds pipe chains and handles file redirections (L233-241)
  - Generates trap commands for cleanup (L243-248)

## Step Kind Constants (L72-82)
Pipeline step types defining input/output requirements:
- `FILEIN_FILEOUT ('ff')`: Requires real files for both input and output
- `STDIN_FILEOUT ('-f')`: Reads stdin, writes file
- `FILEIN_STDOUT ('f-')`: Reads file, writes stdout  
- `STDIN_STDOUT ('--')`: Standard pipeline element
- `SOURCE ('.-')`: Pipeline source (must be first)
- `SINK ('-.')`: Pipeline sink (must be last)

## Dependencies
- `tempfile`: Temporary file creation for intermediate pipeline stages
- `os`: System command execution and file operations
- `shlex.quote`: Shell argument escaping
- `re`: Pattern matching for $IN/$OUT variable validation

## Architectural Patterns
- **Template Pattern**: Reusable pipeline definitions
- **Command Pattern**: Encapsulated shell command execution
- **Chain of Responsibility**: Sequential command processing
- **Resource Management**: Automatic temporary file cleanup via shell traps

## Critical Constraints
- Commands must be valid `/bin/sh` syntax
- File-based steps must include `$IN`/`$OUT` variables in command strings
- SOURCE steps can only be prepended, SINK steps can only be appended
- Pipeline cannot end with SINK for reading or begin with SOURCE for writing