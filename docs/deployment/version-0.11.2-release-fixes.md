# Version 0.11.2 Release Fixes

## Date: January 21, 2025

## Issues Fixed

### 1. NPM Publishing Error
**Error:** Could not publish over previously published version 0.11.0.

**Fix:** Bumped version from 0.11.1 to 0.11.2 in `package.json`.

### 2. PyPI Publishing Error
**Error:** 
```
error: package directory 'mcp_debugger_launcher' does not exist
```

**Root Cause:** The Python package had a non-standard directory structure with duplicate files in both the root directory and a subdirectory.

**Fix:** Reorganized to standard Python package structure:

#### Before (problematic):
```
mcp_debugger_launcher/
├── __init__.py         # Duplicate in root
├── cli.py              # Duplicate in root
├── detectors.py        # Duplicate in root
├── launcher.py         # Duplicate in root
├── pyproject.toml
├── README.md
├── LICENSE
├── mcp_debugger_launcher/  # Subdirectory with duplicates
│   ├── __init__.py
│   ├── cli.py
│   ├── detectors.py
│   └── launcher.py
└── tests/
    └── test_launcher.py
```

#### After (standard structure):
```
mcp_debugger_launcher/
├── pyproject.toml      # Configuration at root
├── README.md           # Documentation at root
├── LICENSE             # License at root
├── mcp_debugger_launcher/  # Package directory
│   ├── __init__.py
│   ├── cli.py
│   ├── detectors.py
│   └── launcher.py
└── tests/
    └── test_launcher.py
```

### Changes Made

1. **Removed duplicate files** from the root directory, keeping only configuration files
2. **Updated pyproject.toml** to use simplified package configuration:
   ```toml
   [tool.setuptools]
   packages = ["mcp_debugger_launcher"]
   ```
3. **Bumped version to 0.11.2** in both `package.json` and `pyproject.toml`

### Test Results

Successfully built Python package:
- Created `debug_mcp_server_launcher-0.11.2-py3-none-any.whl`
- Created `debug_mcp_server_launcher-0.11.2.tar.gz`

Both packages should now publish successfully to their respective registries.
