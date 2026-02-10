# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/antigravity.py
@source-hash: 8a5ee63e1b79ba27
@generated: 2026-02-09T18:08:27Z

## Purpose
Easter egg Python module that opens an XKCD comic and implements the geohash algorithm. This is a standard Python library easter egg inspired by XKCD comics #353 and #426.

## Key Components

### Module Execution (L5)
- Automatically opens XKCD comic #353 ("Python") in default web browser upon import
- No conditional execution - runs immediately when module is imported

### geohash Function (L7-17)
- **Purpose**: Implements the Munroe geohash algorithm for generating pseudo-random coordinates
- **Parameters**: 
  - `latitude`: Base latitude coordinate
  - `longitude`: Base longitude coordinate  
  - `datedow`: Date string as bytes (format: b'YYYY-MM-DD-STOCK_PRICE')
- **Algorithm**: Uses MD5 hash of date parameter to generate fractional offsets
- **Output**: Prints modified coordinates to stdout (does not return values)

## Dependencies
- `webbrowser`: Standard library module for opening URLs
- `hashlib`: Standard library module for MD5 hashing

## Implementation Details
- MD5 hash is split into two 16-character hex segments for lat/lon offsets (L16)
- Uses `usedforsecurity=False` parameter for MD5 to avoid security warnings (L15)
- Converts hex strings to floats using `float.fromhex()` method (L16)
- String formatting removes leading '0' from fractional parts (L17)

## Usage Context
Part of Python's standard library easter eggs. Typically discovered when someone types `import antigravity` in a Python REPL, referencing the famous XKCD comic about Python's ease of use.