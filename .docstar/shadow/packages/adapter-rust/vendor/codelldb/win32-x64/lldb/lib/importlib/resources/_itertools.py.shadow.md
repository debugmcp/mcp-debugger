# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/resources/_itertools.py
@source-hash: 7838ac57a46a88d6
@generated: 2026-02-09T18:06:07Z

**Purpose**: Utility function from more_itertools library that ensures an iterable contains exactly one item, providing controlled behavior for empty or multi-item cases.

**Core Function**:
- `only()` (L2-38): Validates iterable has exactly one element
  - Returns the single item if found
  - Returns `default` parameter if iterable is empty
  - Raises exception (ValueError by default, customizable via `too_long`) if multiple items exist
  - Uses iterator advancement strategy to detect multiple items without consuming entire iterable

**Key Implementation Details**:
- Iterator creation (L24): Converts input to iterator for uniform handling
- First value extraction (L25): Uses `next()` with default fallback
- Second value detection (L27-30): Attempts to get second item to detect multiplicity
- Exception handling (L32-36): Constructs descriptive error message showing first two values
- Error customization (L36): Allows custom exception type via `too_long` parameter

**Behavioral Characteristics**:
- Destructive iteration: Advances iterator up to 2 positions to validate uniqueness
- Early termination: Stops checking after finding second item (doesn't consume entire iterable)
- Flexible error handling: Supports both default ValueError and custom exception types

**Dependencies**: None (uses only built-in Python functions)

**Use Cases**: Validation scenarios where exactly one result is expected from queries, searches, or filtering operations.