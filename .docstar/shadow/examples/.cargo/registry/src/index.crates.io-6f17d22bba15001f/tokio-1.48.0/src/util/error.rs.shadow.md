# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/error.rs
@source-hash: de1a0d662e9359da
@generated: 2026-02-09T18:06:43Z

## Purpose
Central error message definitions for Tokio runtime context issues. Provides standardized error strings used throughout the Tokio codebase when runtime context is missing, shutting down, or corrupted.

## Key Constants
- `CONTEXT_MISSING_ERROR` (L5-6): Error message for when no Tokio reactor is running in the current context
- `RUNTIME_SHUTTING_DOWN_ERROR` (L9-10): Error message for when Tokio context exists but is in shutdown state
- `THREAD_LOCAL_DESTROYED_ERROR` (L15-16): Error message for when thread-local storage containing Tokio context has been destroyed

## Architecture Notes
- All constants are `pub(crate)` - internal to Tokio crate but accessible across modules
- Uses conditional compilation (`#![cfg_attr]`) to suppress dead code warnings when "full" feature is disabled (L2)
- Error messages are self-documenting and provide clear guidance about Tokio 1.x runtime requirements

## Usage Pattern
These constants are referenced throughout Tokio when operations require a valid runtime context. The different error types help distinguish between:
1. No runtime initialized
2. Runtime in shutdown process  
3. Thread-local corruption/destruction

## Dependencies
None - pure constant definitions with no external dependencies.