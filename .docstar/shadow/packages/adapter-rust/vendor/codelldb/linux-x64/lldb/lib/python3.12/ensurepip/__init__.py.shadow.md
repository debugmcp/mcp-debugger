# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/ensurepip/__init__.py
@source-hash: 3429637caf0335c1
@generated: 2026-02-09T18:06:15Z

## Purpose
Python standard library module for bootstrapping pip installation. Provides functionality to install pip into Python environments, with support for both bundled wheels and system-distributed wheel packages.

## Key Constants & Configuration
- `_PIP_VERSION = "24.2"` (L13): Currently bundled pip version
- `_PACKAGE_NAMES = ('pip',)` (L12): Packages managed by ensurepip
- `_PROJECTS` (L14-16): Project metadata tuples (name, version, py_tag)
- `_WHEEL_PKG_DIR` (L27): System wheel directory path from sysconfig
- `_Package` namedtuple (L20-21): Represents package with version, wheel_name, wheel_path

## Core Functions

### Package Discovery & Management
- `_find_packages(path)` (L30-56): Scans directory for wheel files, extracts versions from filenames, returns package dict
- `_get_packages()` (L59-75): Returns cached package info, prefers system wheels over bundled if all packages found

### Pip Execution
- `_run_pip(args, additional_paths=None)` (L78-101): Executes pip in subprocess with custom sys.path, handles isolation mode
- `_disable_pip_configuration_settings()` (L111-120): Clears PIP_* environment variables and sets PIP_CONFIG_FILE to /dev/null

### Bootstrap Functions
- `bootstrap()` (L123-135): Public API wrapper, calls `_bootstrap()` and discards return code
- `_bootstrap()` (L138-200): Core bootstrap implementation:
  - Validates altinstall/default_pip conflict (L147-148)
  - Triggers sys.audit (L150)
  - Configures ENSUREPIP_OPTIONS environment variable (L160-165)
  - Extracts wheels to temporary directory (L167-187)
  - Constructs pip install arguments (L189-199)
  - Invokes pip with wheel files (L200)

### Utility Functions
- `version()` (L104-108): Returns bundled pip version string
- `_uninstall_helper()` (L202-230): Uninstalls pip if version matches bundled version
- `_main()` (L233-291): CLI argument parser and main entry point

## Architecture Notes
- Uses lazy loading pattern with global `_PACKAGES = None` (L75)
- Supports dual wheel sources: bundled wheels via importlib.resources and system wheel directory
- Subprocess isolation prevents pip state leakage
- Temporary directory cleanup handled by context manager
- Environment variable manipulation for pip behavior control

## Dependencies
- Standard library: collections, os, subprocess, sys, sysconfig, tempfile, argparse
- importlib.resources for bundled wheel access
- runpy for pip module execution

## Critical Invariants
- Only uninstalls pip if versions match exactly (L216)
- System wheels take precedence only if ALL required packages found (L71)
- Subprocess execution prevents state contamination
- Temporary files automatically cleaned up