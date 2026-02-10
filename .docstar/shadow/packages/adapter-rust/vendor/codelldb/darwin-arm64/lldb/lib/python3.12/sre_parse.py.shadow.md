# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/sre_parse.py
@source-hash: c492913453230608
@generated: 2026-02-09T18:07:14Z

## Purpose and Responsibility

This file serves as a deprecated compatibility shim for the `sre_parse` module, redirecting all functionality to `re._parser`. The module exists solely to maintain backward compatibility while warning users about its deprecated status.

## Key Components

**Deprecation Warning (L1-4)**: Issues a `DeprecationWarning` when the module is imported, informing users that `sre_parse` is deprecated and should be replaced with the modern `re._parser` module.

**Module Content Forwarding (L6-7)**: Dynamically imports all public attributes from `re._parser` and injects them into the current module's namespace using `globals().update()`. The list comprehension filters out private/dunder attributes (those starting with double underscores).

## Dependencies

- **re._parser**: The actual implementation module that provides all regex parsing functionality
- **warnings**: Standard library module used for deprecation notifications

## Architectural Pattern

This implements a **deprecation facade pattern** - a thin wrapper that maintains API compatibility while guiding users toward the preferred interface. The dynamic attribute forwarding ensures that all public APIs from `re._parser` remain accessible through the deprecated `sre_parse` module name.

## Critical Invariants

- All public attributes from `re._parser` are exposed with identical names and behavior
- Private/internal attributes (starting with `__`) are intentionally excluded from forwarding
- The deprecation warning is issued on every import to encourage migration