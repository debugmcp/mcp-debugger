# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/metadata/_adapters.py
@source-hash: de9a880abc4513af
@generated: 2026-02-09T18:06:13Z

## Primary Purpose
Email message adapter for Python package metadata processing, extending `email.message.Message` to handle PEP 566 compliant package metadata with special handling for multiple-value keys and JSON serialization.

## Key Classes and Functions

### Message (L19-89)
Extends `email.message.Message` to handle package metadata with PEP 566 compliance.

**Key attributes:**
- `multiple_use_keys` (L20-36): Set of FoldedCase keys that may appear multiple times per PEP 566 (Classifier, Platform, Requires-Dist, etc.)

**Key methods:**
- `__new__(cls, orig)` (L41-44): Factory method that creates new instance while preserving original message variables
- `__getitem__(item)` (L53-61): Override with deprecation warning for None return values 
- `_repair_headers()` (L63-73): Processes headers with RFC822 indentation correction and appends Description from payload
- `json` property (L75-89): Converts metadata to JSON-compatible dict per PEP 566, handling multiple-use keys and Keywords transformation

### Helper Functions
- `redent(value)` (L64-68): Local function for correcting RFC822 indentation using textwrap.dedent
- `transform(key)` (L82-87): Local function for JSON conversion that handles multiple-use keys and Keywords splitting

## Dependencies
- `email.message`: Base Message class
- `_text.FoldedCase`: Case-insensitive string handling
- `functools`, `warnings`, `re`, `textwrap`: Standard library utilities

## Architectural Patterns
- Adapter pattern: Wraps email.message.Message with metadata-specific behavior
- Deprecation warning system using `functools.partial` (L11-16)
- Property-based JSON serialization with key transformation (lowercase, underscore replacement)

## Critical Invariants
- Multiple-use keys defined by PEP 566 must return lists when accessed via `get_all()`
- Keywords field requires space-based splitting for JSON output
- Headers undergo RFC822 indentation correction
- Deprecation warnings for None return values will become KeyErrors in future versions