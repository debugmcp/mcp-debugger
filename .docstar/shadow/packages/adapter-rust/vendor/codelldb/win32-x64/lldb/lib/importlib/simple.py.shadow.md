# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/simple.py
@source-hash: 8e687aeeb1db537d
@generated: 2026-02-09T18:11:05Z

## Purpose
Compatibility shim module that provides backward compatibility for Python 3.10 by re-exporting resource handling classes from `.resources.simple`. Acts as a bridge layer for consumers who need to support Python 3.10 while the canonical implementation exists in the `resources.simple` module.

## Key Components
- **Import re-exports (L8-10)**: Re-exports four core classes from `.resources.simple`:
  - `SimpleReader`: Basic resource reader implementation
  - `ResourceHandle`: Handle for individual resources
  - `ResourceContainer`: Container abstraction for resources
  - `TraversableReader`: Reader supporting traversable interfaces
- **Public API definition (L12-14)**: `__all__` list explicitly defines the public interface, ensuring clean namespace exposure

## Dependencies
- **Internal dependency**: `.resources.simple` module (relative import)
- **Python version context**: Designed for Python 3.10 compatibility (consumers using Python 3.11+ should use the source module directly)

## Architectural Pattern
Implements the **compatibility shim pattern** - a thin wrapper that maintains API stability across Python versions. The module serves as a stable import location while the actual implementation may move or change in newer Python versions.

## Usage Context
This is part of the LLDB Python integration within a Rust adapter package, suggesting it's used for debugging/development tooling where consistent resource access APIs are critical across Python versions.