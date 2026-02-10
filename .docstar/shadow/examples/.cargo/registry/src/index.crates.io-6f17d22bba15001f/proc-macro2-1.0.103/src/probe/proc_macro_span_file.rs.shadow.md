# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/probe/proc_macro_span_file.rs
@source-hash: a20a1920d121b153
@generated: 2026-02-09T18:06:20Z

## Purpose
Provides a compatibility layer for Span file operations stabilized in Rust 1.88, wrapping `proc_macro::Span` file-related methods.

## Key Functions
- `file()` (L8-10): Extracts the source file name from a Span as a String
- `local_file()` (L12-14): Extracts the local file path from a Span as an optional PathBuf

## Dependencies
- `proc_macro::Span`: Core procedural macro span type from standard library
- `std::path::PathBuf`: Standard library path handling

## Architecture
Simple delegation pattern - both functions act as thin wrappers around corresponding methods on `proc_macro::Span`. This module serves as a compatibility shim for accessing file information from spans, likely part of a version-specific feature detection system within proc-macro2.

## Usage Context
Part of proc-macro2's probe system for detecting and utilizing Rust compiler features as they become stabilized. The "1.88" reference in the comment indicates this targets functionality available from Rust version 1.88 onwards.