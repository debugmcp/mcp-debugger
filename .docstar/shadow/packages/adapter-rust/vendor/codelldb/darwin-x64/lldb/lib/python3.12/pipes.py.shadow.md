# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/pipes.py
@source-hash: 153f2d249d954b55
@generated: 2026-02-09T18:08:16Z

**Purpose & Responsibility**
Pipeline template system for chaining shell commands with automatic temporary file management. Creates reusable conversion pipelines that handle different input/output requirements (files vs streams) and manages intermediate temporary files transparently.

**Architecture & Key Classes**

- **Template (L85-182)**: Core pipeline builder class
  - `__init__()` (L88-91): Initializes empty pipeline with debugging flag
  - `reset()` (L97-99): Clears pipeline steps
  - `clone()` (L101-107): Creates deep copy of template
  - `append()` (L113-127): Adds command to end with validation
  - `prepend()` (L129-143): Adds command to beginning with validation
  - `open()` (L145-153): Opens pipeline for reading/writing
  - `open_r()` (L155-163): Opens pipeline for reading
  - `open_w()` (L165-171): Opens pipeline for writing
  - `copy()` (L173-174): Executes pipeline between files
  - `makepipeline()` (L176-181): Builds shell command string

**Core Functions**

- **makepipeline() (L184-250)**: Complex pipeline assembly function
  - Handles file/stream transitions between pipeline stages
  - Creates temporary files for file-to-file connections
  - Builds shell command with proper quoting and cleanup traps

**Pipeline Step Types (L72-82)**
- `FILEIN_FILEOUT` ('ff'): Requires real files for both input/output
- `STDIN_FILEOUT` ('-f'): Reads stdin, writes file
- `FILEIN_STDOUT` ('f-'): Reads file, writes stdout
- `STDIN_STDOUT` ('--'): Normal pipeline element
- `SOURCE` ('.-'): Pipeline source (first step only)
- `SINK` ('-.`): Pipeline sink (last step only)

**Dependencies**
- `re`: Pattern matching for $IN/$OUT variable validation
- `os`: System commands and popen operations
- `tempfile`: Temporary file creation for intermediate stages
- `shlex.quote`: Safe shell argument quoting
- `warnings`: Deprecation notice (module deprecated in Python 3.13)

**Key Patterns**
- Command validation ensures $IN/$OUT variables present when required
- Automatic temporary file cleanup via shell traps
- Pipeline step ordering constraints (SOURCE first, SINK last)
- Shell command construction with proper quoting for security

**Critical Constraints**
- Commands must be valid /bin/sh syntax
- SOURCE steps can only be prepended (L119-120)
- SINK steps can only be appended (L135-136)
- File-based steps must reference $IN/$OUT variables (L123-126, L139-142)
- Pipeline cannot end with SINK for reading (L160-161)
- Pipeline cannot start with SOURCE for writing (L168-169)