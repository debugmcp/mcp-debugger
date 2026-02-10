# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/__init__.py
@source-hash: c9e1b3dbc619ac31
@generated: 2026-02-09T18:11:10Z

## Primary Purpose
Entry point for Python's importlib package providing the core import functionality as a pure Python implementation. This is the main `__init__.py` that bootstraps the import system and exposes the public API.

## Bootstrap Architecture (L4-55)
Critical two-stage bootstrap process that initializes Python's import machinery:

**Stage 1: Core Bootstrap (L15-31)**
- Attempts to import frozen `_frozen_importlib` as `_bootstrap` (L16)
- Falls back to local `_bootstrap` module if frozen version unavailable (L18-19)
- Properly configures module metadata and registers in `sys.modules` (L23-31)

**Stage 2: External Bootstrap (L33-48)**
- Similar pattern for `_frozen_importlib_external` as `_bootstrap_external` (L34-48)
- Cross-links the two bootstrap modules via `_bootstrap._bootstrap_external` (L38)
- Handles missing `__file__` attribute for frozen environments (L27-30, L44-47)

**Utility Exports (L51-52)**
- Exposes `_pack_uint32` and `_unpack_uint32` from bootstrap_external for test code

## Public API Functions

**invalidate_caches() (L65-70)**
- Calls `invalidate_caches()` on all meta path finders in `sys.meta_path`
- Used to clear import-related caches when filesystem changes occur

**import_module(name, package=None) (L73-90)**
- High-level interface for programmatic imports
- Handles relative imports by counting leading dots and requiring `package` parameter (L82-89)
- Delegates to `_bootstrap._gcd_import()` with calculated import level (L90)

**reload(module) (L96-138)**
- Module reloading implementation with cycle detection
- Uses global `_RELOADING` dict to prevent infinite recursion (L93, L112-114, L136-137)
- Validates module is in `sys.modules` and extracts name from `__spec__` or `__name__` (L103-111)
- Handles parent package resolution for submodules (L116-126)
- Re-finds module spec and re-executes it (L128-131)
- Returns potentially replaced module from `sys.modules` (L133)

## Key Dependencies
- `_imp`: Builtin import component (L12)
- `sys`: System module access (L13)
- `_bootstrap`/`_bootstrap_external`: Core import machinery modules
- `warnings`: Standard library (L57)

## Critical Design Patterns
- **Frozen/Fallback Pattern**: Prefers frozen C implementations over pure Python versions
- **Bootstrap Isolation**: Careful module initialization order to avoid circular imports
- **Graceful Degradation**: Handles missing `__file__` in frozen environments
- **Cycle Detection**: Uses module-level state to prevent reload cycles

## Architectural Constraints
- Must not import modules that depend on `importlib._bootstrap` during bootstrap phase (L6-11)
- Bootstrap completion marked at L54-55 before general imports allowed
- Module replacement handling in reload() accounts for modules that replace themselves in `sys.modules`