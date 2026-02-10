# packages/adapter-rust/vendor/codelldb/linux-arm64/lang_support/__init__.py
@source-hash: 044b446a66eee6c4
@generated: 2026-02-09T18:13:18Z

**Primary Purpose:** LLDB debugger module initializer that dynamically loads language-specific support modules for CodeLLDB adapter.

**Key Function:**
- `__lldb_init_module()` (L7-22): Entry point called by LLDB debugger during initialization. Takes debugger instance and internal dictionary containing adapter settings. Iterates through configured source languages and attempts to load corresponding language support modules via dynamic import, then calls their initialization functions.

**Core Logic Flow:**
1. Extracts `sourceLanguages` list from adapter settings (L8-9)
2. Dynamically imports language-specific modules from `lang_support` package (L12)
3. Attempts to retrieve module attribute by language name (L13)
4. Calls each module's `__lldb_init_module()` if it exists (L18)
5. Handles initialization failures gracefully with logging and console output (L19-22)

**Dependencies:**
- Standard `logging` module for debug/info logging (L1, L4)
- Uses dynamic imports via `__import__()` with fromlist parameter (L12)

**Error Handling:**
- Missing language modules logged as debug messages (L15)
- Module initialization exceptions caught, logged, and printed to console (L19-22)

**Architectural Notes:**
- Follows LLDB's plugin initialization convention with `__lldb_init_module` signature
- Uses dynamic module loading pattern to support extensible language-specific functionality
- Part of CodeLLDB's language support system for enhanced debugging capabilities

**Configuration:**
- Driven by `adapter_settings['sourceLanguages']` array configuration
- Fails gracefully when language modules don't exist or fail to initialize