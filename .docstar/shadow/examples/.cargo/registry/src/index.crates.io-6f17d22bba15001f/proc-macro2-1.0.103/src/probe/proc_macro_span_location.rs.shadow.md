# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/probe/proc_macro_span_location.rs
@source-hash: 71a4768f65f8a87e
@generated: 2026-02-09T18:06:21Z

## Purpose
Wrapper module providing access to Rust 1.88 stabilized Span location APIs. Part of proc-macro2's feature probing system to conditionally expose newer standard library functionality.

## Key Functions
- `start(this: &Span) -> Span` (L7-9): Returns starting position of a span as a new Span
- `end(this: &Span) -> Span` (L11-13): Returns ending position of a span as a new Span  
- `line(this: &Span) -> usize` (L15-17): Returns line number of span location
- `column(this: &Span) -> usize` (L19-21): Returns column number of span location

## Dependencies
- `proc_macro::Span` (L5): Direct dependency on standard library's procedural macro span type

## Architectural Context
This is a probe module - part of proc-macro2's conditional compilation strategy. The file name and comment indicate this exposes Span location methods that were stabilized in Rust 1.88. Used by proc-macro2 to provide consistent API across Rust versions by wrapping newer stdlib features when available.

## Pattern
Simple delegation pattern - all functions take `&Span` by reference and directly call the corresponding method on the span, maintaining the same signature and return types as the standard library.