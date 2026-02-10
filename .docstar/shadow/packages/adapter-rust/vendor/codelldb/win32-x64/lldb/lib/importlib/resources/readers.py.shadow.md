# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/resources/readers.py
@source-hash: 10884a02b4a97636
@generated: 2026-02-09T18:06:15Z

**Resource Reader Implementation for Python importlib**

This module provides concrete implementations of the `abc.TraversableResources` interface for accessing package resources from different sources (filesystem, zip archives, namespace packages).

## Core Classes

**FileReader (L16-30)**
- Handles file system-based package resources
- Constructor takes a loader and extracts parent directory path (L18)
- `resource_path()` returns absolute filesystem paths to prevent temporary copies (L20-26)
- `files()` returns pathlib.Path object for traversal (L28-29)

**ZipReader (L32-56)**  
- Handles resources within ZIP archives (like .egg files)
- Constructor normalizes path separators and handles package prefixes (L33-38)
- `open_resource()` converts KeyError to FileNotFoundError for missing resources (L40-44)
- `is_resource()` implements workaround for zipfile.Path bug with non-existent paths (L46-52)
- `files()` returns zipfile.Path for archive traversal (L54-55)

**MultiplexedPath (L58-129)**
- Implements merged view over multiple Traversable paths for namespace packages
- Constructor validates all paths are directories and removes duplicates (L66-72)
- `iterdir()` merges children from all paths, grouping by name (L74-78)
- File operations (`read_bytes`, `read_text`, `open`) raise FileNotFoundError since it's directory-only (L80-84, L119-120)
- `_follow()` class method intelligently constructs single path or MultiplexedPath based on child count (L100-117)
- `joinpath()` falls back to first path on traversal errors (L92-98)

**NamespaceReader (L131-146)**
- Wrapper for namespace packages using MultiplexedPath
- Validates input is NamespacePath through string inspection (L133-134)
- Provides same interface as FileReader but over multiplexed paths

## Utility Functions

**remove_duplicates() (L12-13)**
- Preserves order while removing duplicates using OrderedDict.fromkeys()

## Key Dependencies

- `abc` module for TraversableResources interface (L7)
- `_itertools.only` for single-item extraction (L9)
- Standard library: pathlib, zipfile, collections, itertools, operator

## Design Patterns

- **Strategy Pattern**: Different reader classes handle different resource sources
- **Composite Pattern**: MultiplexedPath merges multiple paths into unified interface  
- **Adapter Pattern**: Readers adapt loader objects to TraversableResources interface

## Critical Constraints

- MultiplexedPath requires at least one path and only supports directories
- ZipReader normalizes Windows path separators to forward slashes
- NamespaceReader validates input through string inspection rather than type checking