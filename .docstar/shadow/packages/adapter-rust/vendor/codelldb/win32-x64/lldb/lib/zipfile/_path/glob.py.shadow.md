# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/zipfile/_path/glob.py
@source-hash: 64e27d3872da2ea1
@generated: 2026-02-09T18:06:06Z

**Purpose:** Glob pattern to regex translation for zipfile.Path, handling directory matching with trailing slash semantics.

**Key Functions:**

- `translate(pattern)` (L4-5): Main entry point that converts glob patterns to regex with directory matching support
- `translate_core(pattern)` (L17-28): Core glob-to-regex translator handling `*`, `?`, `**` wildcards
- `match_dirs(pattern)` (L8-14): Adds optional trailing slash `[/]?` to handle zipfile.Path directory names
- `separate(pattern)` (L31-40): Tokenizes glob pattern, isolating character sets `[...]` from regular content
- `replace(match)` (L43-53): Applies regex escaping and wildcard translations for each token

**Glob Translation Rules:**
- `*` → `[^/]*` (match any chars except directory separator)
- `**` → `.*` (match across directory boundaries)
- `?` → `.` (single character wildcard)
- Character sets `[...]` preserved as-is
- All other characters regex-escaped

**Architecture:**
Uses regex `finditer` with capture groups to separate character sets from regular content, then applies different translation rules to each token type. The pipeline ensures zipfile.Path directory semantics are handled correctly with optional trailing slashes.

**Dependencies:** 
- `re` module for regex operations

**Critical Behavior:**
Directory matching accommodation for zipfile.Path's trailing slash convention ensures patterns match both file and directory entries correctly.