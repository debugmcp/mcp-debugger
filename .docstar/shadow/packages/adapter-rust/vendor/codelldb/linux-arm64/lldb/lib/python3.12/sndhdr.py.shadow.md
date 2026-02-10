# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/sndhdr.py
@source-hash: d1cb49f6545ef831
@generated: 2026-02-09T18:09:06Z

## Purpose
Sound file header recognition module that identifies various audio file formats by examining their binary headers. Part of Python's deprecated standard library (deprecated in Python 3.13).

## Core API
- **what(filename)** (L56-59): Main public function that returns sound file info by calling whathdr()
- **whathdr(filename)** (L62-70): Core recognition function that reads first 512 bytes and tests against all format detectors, returns SndHeaders namedtuple or None

## Data Structure
- **SndHeaders** (L41-54): namedtuple containing (filetype, framerate, nchannels, nframes, sampwidth) with documented fields for structured sound metadata

## Format Detection System
Registry-based architecture using **tests** list (L77) containing detection functions:
- **test_aifc()** (L79-98): AIFC/AIFF files via 'FORM' header + aifc module
- **test_au()** (L103-132): AU/SND files with big/little endian support
- **test_hcom()** (L137-146): HCOM format with specific byte signatures
- **test_voc()** (L151-161): Creative Voice File format
- **test_wav()** (L166-178): WAV files via RIFF header + wave module
- **test_8svx()** (L183-188): 8SVX format (assumes mono)
- **test_sndt()** (L193-198): SNDT format
- **test_sndr()** (L203-208): SNDR format with rate validation

## Utility Functions
Byte extraction utilities for binary parsing:
- **get_long_be/le()** (L217-221): 32-bit big/little endian
- **get_short_be/le()** (L223-227): 16-bit big/little endian

## Test Program
- **test()** (L234-247): CLI entry point with recursive directory scanning
- **testall()** (L249-268): Recursive file processing with glob support

## Dependencies
- Standard library: warnings, collections.namedtuple, sys, os, glob
- Format-specific: aifc, wave modules for detailed parsing

## Architecture Notes
- Each test function receives header bytes and file object, returns tuple or None
- Tests run sequentially until first match found
- Graceful fallback to basic header parsing when format-specific modules fail