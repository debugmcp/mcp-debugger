# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/sndhdr.py
@source-hash: d1cb49f6545ef831
@generated: 2026-02-09T18:10:00Z

## Purpose

Python module for recognizing and parsing audio/sound file headers. Part of Python's deprecated standard library (removal scheduled for Python 3.13), providing SOX-compatible format detection for various audio file types.

## Core API

- **`what(filename)` (L56-59)**: Main entry point that delegates to `whathdr()` for sound file type detection
- **`whathdr(filename)` (L62-70)**: Core header recognition function that reads first 512 bytes and runs format-specific tests, returns `SndHeaders` namedtuple or `None`
- **`SndHeaders` namedtuple (L41-54)**: Return structure containing `(filetype, framerate, nchannels, nframes, sampwidth)` with documented field meanings

## Format Detection Functions

All functions follow pattern `test_<format>(h, f)` where `h` is header bytes and `f` is file object:

- **`test_aifc(h, f)` (L79-98)**: AIFC/AIFF files, uses `aifc` module for parsing
- **`test_au(h, f)` (L103-132)**: AU/SND files with big/little endian support
- **`test_hcom(h, f)` (L137-146)**: HCOM format with sample rate calculation
- **`test_voc(h, f)` (L151-161)**: Creative Voice File format
- **`test_wav(h, f)` (L166-178)**: WAV files using `wave` module
- **`test_8svx(h, f)` (L183-188)**: 8SVX Amiga format
- **`test_sndt(h, f)` (L193-198)**: SNDT format
- **`test_sndr(h, f)` (L203-208)**: SNDR format with rate validation

## Utilities

- **Byte extraction functions (L217-227)**: `get_long_be/le`, `get_short_be/le` for parsing binary data in different endianness
- **Test registry (L77)**: `tests` list populated by individual format testers

## Test Program

- **`test()` (L234-247)**: CLI entry point with recursive directory support
- **`testall()` (L249-268)**: Recursive file processor for testing multiple files

## Architecture

Uses plugin-like architecture where each format has dedicated test function registered in `tests` list. Detection works by trying each test sequentially until one succeeds. Each test function performs magic number validation then delegates to appropriate standard library module when available.