# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pyclbr.py
@source-hash: e8ca09333701ba41
@generated: 2026-02-09T18:09:01Z

## Purpose
Python code browser that statically parses Python modules to extract class and function definitions without execution. Part of Python's standard library for introspection and IDE support.

## Core Architecture

### Data Model Classes (L53-85)
- **`_Object`** (L53-65): Base class for all parsed entities with common attributes (module, name, file, lineno, end_lineno, parent, children)
- **`Function`** (L68-76): Extends `_Object` for function/method definitions, adds `is_async` flag
- **`Class`** (L78-85): Extends `_Object` for class definitions, adds `super` (inheritance list) and `methods` dict

### Public API (L100-119)
- **`readmodule(module, path=None)`** (L100-110): Legacy interface returning only top-level classes
- **`readmodule_ex(module, path=None)`** (L112-119): Main interface returning all functions and classes

### Core Parsing Logic
- **`_readmodule(module, path, inpackage=None)`** (L122-183): Module resolution and caching engine
  - Handles module cache via global `_modules` dict (L50)
  - Resolves dotted imports and package hierarchies
  - Uses `importlib.util` for spec-based module finding
- **`_ModuleBrowser`** (L186-267): AST visitor that builds object tree
  - Maintains parsing stack for nested definitions
  - Handles class inheritance resolution via `visit_ClassDef` (L195-218)
  - Processes import statements to resolve superclasses

### Key Behaviors
- **Inheritance Resolution**: Attempts to resolve superclass references to actual Class objects
- **Import Tracking**: Processes `import` and `from...import` statements to build complete namespace
- **Nested Structure Support**: Maintains parent-child relationships for nested classes/functions
- **Caching**: Global module cache prevents redundant parsing

### Utility Functions
- **`_nest_function/class`** (L89-97): Factory functions for creating nested objects
- **`_create_tree`** (L269-272): Coordinates AST parsing via _ModuleBrowser
- **`_main`** (L275-314): CLI interface for debugging/visualization

## Dependencies
- `ast`: Python AST parsing
- `importlib.util`: Module specification and loading
- `sys`: Built-in module detection and path handling

## Critical Constraints
- Only parses Python source files (skips compiled/binary modules)
- Import errors are silently ignored to prevent crashes
- Column offset filtering ensures only top-level imports are processed