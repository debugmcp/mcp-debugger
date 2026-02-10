# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/debugger.py
@source-hash: 2ae4e9964c6b0b7d
@generated: 2026-02-09T18:12:34Z

## Primary Purpose
Entry point module for CodeLLDB debugger adapter that imports all functionality from the main `codelldb` package. This file serves as a convenience wrapper to expose the complete debugger API.

## Key Components
- **Wildcard import (L1)**: Imports all public symbols from the `codelldb` module using `from codelldb import *`

## Dependencies
- **codelldb**: Core debugger package containing the main implementation

## Architecture Notes
This is a minimal bootstrap file that relies entirely on the `codelldb` package for functionality. The wildcard import pattern suggests this file is intended as a simplified entry point that exposes the complete debugger interface without requiring users to know the internal module structure.

## Critical Constraints
- File depends entirely on the `codelldb` package being available and properly installed
- Any changes to the `codelldb` module's public API will directly affect what symbols are available through this module
- The wildcard import makes it difficult to determine what specific functionality is exposed without examining the source `codelldb` module