# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/resources/abc.py
@source-hash: a726c48590b21ba5
@generated: 2026-02-09T18:06:11Z

## Purpose
Abstract base classes and protocols for Python's importlib.resources system, defining interfaces for resource reading and file system traversal. Part of the standard library's resource access abstraction layer.

## Key Classes and Protocols

### ResourceReader (L16-56)
Abstract base class defining the interface for loaders to provide resource reading support. Key methods:
- `open_resource(resource)` (L19-29): Returns binary file-like object for reading resources
- `resource_path(resource)` (L31-42): Returns filesystem path to resource  
- `is_resource(path)` (L44-50): Checks if path represents a resource (file vs directory)
- `contents()` (L52-55): Returns iterable of package contents

All abstract methods deliberately raise `FileNotFoundError` instead of `NotImplementedError` for proper error handling when accidentally called.

### Traversable Protocol (L62-151)
Runtime-checkable protocol providing pathlib.Path-like interface for directory traversal and file access:
- `iterdir()` (L72-76): Abstract method yielding child Traversable objects
- `read_bytes()` (L78-83): Concrete method reading file contents as bytes
- `read_text(encoding)` (L85-90): Concrete method reading file contents as text
- `is_dir()` (L92-96): Abstract method checking if object is directory
- `is_file()` (L98-102): Abstract method checking if object is file
- `joinpath(*descendants)` (L104-127): Concrete method for path resolution with traversal error handling
- `__truediv__(child)` (L129-133): Implements `/` operator for path joining
- `open(mode, *args, **kwargs)` (L135-143): Abstract method for file opening
- `name` property (L145-150): Abstract property returning base name

### TraversableResources (L153-173)
Concrete implementation of ResourceReader using Traversable interface:
- `files()` (L159-161): Abstract method returning root Traversable
- Implements all ResourceReader methods using the Traversable interface
- `open_resource()` (L163-164): Uses traversable path joining and opening
- `resource_path()` (L166-167): Always raises FileNotFoundError (resources may not have filesystem paths)
- `is_resource()` (L169-170): Checks if path is a file via traversable
- `contents()` (L172-173): Returns names of all items in root traversable

## Type Definitions
- `StrPath` (L11): Union type for string or PathLike string paths

## Exception Classes
- `TraversalError` (L58-59): Custom exception for path traversal failures

## Architecture
This module establishes a two-layer abstraction: ResourceReader provides the basic interface, while Traversable offers a more powerful filesystem-like protocol. TraversableResources bridges these by implementing ResourceReader using Traversable operations, enabling more flexible resource access patterns.