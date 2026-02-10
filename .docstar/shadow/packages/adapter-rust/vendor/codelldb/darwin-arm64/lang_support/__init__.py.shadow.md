# packages/adapter-rust/vendor/codelldb/darwin-arm64/lang_support/__init__.py
@source-hash: 044b446a66eee6c4
@generated: 2026-02-09T18:13:18Z

**Primary Purpose:** LLDB debugger language support initialization module for CodeLLDB adapter. Dynamically loads and initializes language-specific debugging modules based on configured source languages.

**Core Functionality:**
- `__lldb_init_module(debugger, internal_dict)` (L7-22): Main LLDB initialization hook that:
  - Extracts source languages from adapter settings (L8-9)
  - Dynamically imports language-specific modules from `lang_support` package (L12-13)
  - Calls each language module's initialization function if available (L14-21)
  - Provides error handling and logging for failed initializations (L19-22)

**Key Dependencies:**
- Standard library: `logging`, `os.path`
- LLDB debugger framework (passed as parameter)
- Language-specific modules within `lang_support` package (dynamically imported)

**Architecture Pattern:**
- Plugin architecture using dynamic module loading
- Each supported language expected to have its own module with `__lldb_init_module` function
- Configuration-driven initialization based on `sourceLanguages` setting

**Data Flow:**
1. Reads `sourceLanguages` from `adapter_settings` in `internal_dict` (L8-9)
2. Iterates through configured languages (L11)
3. Dynamically imports each language module using `__import__` (L12-13)
4. Attempts to call language-specific initialization (L17-18)
5. Logs success/failure outcomes (L15, L20-22)

**Error Handling:**
- Graceful handling of missing language modules (L14-16)
- Exception catching with logging and console output for initialization failures (L19-22)
- Non-blocking failures - continues processing remaining languages

**Critical Behavior:**
- Uses `fromlist` parameter in `__import__` to properly import submodules (L12)
- Maintains logging context with module-specific logger (L4)
- Preserves debugger and internal_dict context across language module calls