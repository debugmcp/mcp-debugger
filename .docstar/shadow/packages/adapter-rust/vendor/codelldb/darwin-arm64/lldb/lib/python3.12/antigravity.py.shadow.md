# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/antigravity.py
@source-hash: 8a5ee63e1b79ba27
@generated: 2026-02-09T18:06:57Z

## Primary Purpose
Easter egg Python module that opens the classic XKCD "Import Antigravity" comic and implements the geohash algorithm referenced in another XKCD comic. Part of Python's standard library humor.

## Key Components

### Module-level Behavior (L5)
- Automatically opens "https://xkcd.com/353/" in default web browser upon import
- References the original "import antigravity" XKCD comic

### geohash Function (L7-17)
- Implements the Munroe geohashing algorithm from XKCD comic #426
- **Parameters**: latitude (float), longitude (float), datedow (bytes) - date string in specific format
- **Algorithm**: Uses MD5 hash of date string to generate pseudo-random coordinate offsets
- **Output**: Prints modified coordinates by appending hash-derived decimals to integer parts
- **Example**: geohash(37.421542, -122.085589, b'2005-05-26-10458.68') → "37.857713 -122.544543"

## Dependencies
- `webbrowser`: For opening XKCD URL
- `hashlib`: For MD5 hash computation in geohash algorithm

## Implementation Details
- Hash computation (L15): Uses MD5 with `usedforsecurity=False` flag for non-cryptographic use
- Coordinate manipulation (L16): Converts hex hash segments to floats, extracts decimal portions
- Output formatting (L17): Concatenates integer coordinates with hash-derived decimal suffixes

## Usage Context
This is a novelty module - the geohash function implements a real algorithm used for meetup coordinate generation, but the module's primary purpose is humorous reference to XKCD comics.