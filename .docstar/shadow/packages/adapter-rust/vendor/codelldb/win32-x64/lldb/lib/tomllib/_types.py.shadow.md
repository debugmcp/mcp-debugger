# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tomllib/_types.py
@source-hash: f864c6d9552a929c
@generated: 2026-02-09T18:11:09Z

## Purpose
Type definitions module for the tomllib TOML parser, providing type aliases for key parsing components.

## Key Type Definitions
- **ParseFloat** (L8): Type alias for callable that parses string representations of floating-point numbers into any type
- **Key** (L9): Type alias for tuple of strings representing hierarchical TOML key paths (e.g., `("table", "subtable", "key")`)
- **Pos** (L10): Type alias for integer representing parser position/offset in input text

## Dependencies
- `typing` module for type annotation support (Any, Callable, Tuple)

## Architecture Notes
- Pure type definition module with no implementation logic
- Part of tomllib TOML parser infrastructure
- Follows PSF licensing (Python Software Foundation contributor agreement)
- Uses SPDX license headers for clear licensing attribution

## Usage Context
These type aliases are likely used throughout the tomllib parser to ensure consistent typing for:
- Float parsing callbacks that can return various numeric types
- Hierarchical key representation in nested TOML structures  
- Parser state tracking via position indices