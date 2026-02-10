# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/metadata/__init__.py
@source-hash: 1a26dfee8cb302b7
@generated: 2026-02-09T18:06:25Z

This is the main module of Python's importlib.metadata package, providing a unified interface for accessing metadata from Python distribution packages (wheels, eggs, etc.).

## Core Purpose
Implements the standard library's metadata introspection system for installed packages, supporting both modern .dist-info and legacy .egg-info metadata formats.

## Key Classes

### Distribution (L365-609)
Abstract base class representing a Python distribution package. Core methods:
- `read_text()` (L369): Abstract method for reading metadata files
- `locate_file()` (L377): Abstract method for locating files within distribution
- `from_name()` (L384): Class method to find distribution by package name
- `discover()` (L402): Class method to find all distributions matching criteria
- Properties: `metadata` (L437), `name` (L455), `version` (L465), `entry_points` (L470), `files` (L474), `requires` (L559)

### PathDistribution (L803-854)
Concrete Distribution implementation for filesystem-based packages:
- `__init__()` (L804): Takes SimplePath to metadata directory
- `read_text()` (L811): Reads files from metadata directory
- `locate_file()` (L823): Resolves paths relative to parent directory
- `_name_from_stem()` (L839): Extracts package name from metadata directory name

### EntryPoint (L152-271)
Immutable representation of entry points defined by packages:
- `pattern` (L169): Regex for parsing entry point specifications
- `load()` (L199): Dynamically imports and returns the entry point object
- Properties: `module` (L210), `attr` (L215), `extras` (L220)
- `matches()` (L228): Tests if entry point matches given criteria

### EntryPoints (L273-320)
Immutable collection of EntryPoint objects with selection capabilities:
- `select()` (L289): Filters entry points by criteria
- `__getitem__()` (L280): Gets entry point by name
- Properties: `names` (L297), `groups` (L304)
- `_from_text()` (L315): Parses entry points from text format

### DistributionFinder (L611-657)
Abstract MetaPathFinder for discovering distribution metadata:
- `find_distributions()` (L649): Abstract method to find distributions
- Nested `Context` class (L616): Parameters for narrowing distribution searches

### MetadataPathFinder (L776-801)
Concrete DistributionFinder that searches filesystem paths:
- `find_distributions()` (L778): Searches paths for metadata directories
- `_search_paths()` (L791): Performs heuristic search across multiple paths
- `invalidate_caches()` (L799): Clears FastPath caches

### FastPath (L659-704)
Optimized path searching with caching:
- `__new__()` (L669): Uses LRU cache for path instances
- `children()` (L678): Lists directory contents or zip file entries
- `search()` (L692): Searches for metadata using cached Lookup

### Lookup (L706-740)
Indexes metadata directories by normalized package names:
- `__init__()` (L707): Builds indexes of .dist-info and .egg-info directories
- `search()` (L728): Returns matching metadata paths for prepared search

## Utility Classes

### PackagePath (L322-336)
pathlib.PurePosixPath subclass for files within packages:
- `read_text()` (L325), `read_binary()` (L329): Read file contents
- `locate()` (L333): Returns actual file path via distribution

### Sectioned (L60-123)
Config parser for entry point files:
- `read()` (L110): Parses sectioned text into name-value pairs
- `section_pairs()` (L102): Converts sections to structured pairs

### Prepared (L742-774)
Handles package name normalization for searches:
- `normalize()` (L758): PEP 503 normalization with dash-to-underscore
- `legacy_normalize()` (L765): Legacy normalization for older formats

## Public API Functions
- `distribution()` (L856): Get Distribution for named package
- `distributions()` (L865): Get all Distribution instances
- `metadata()` (L873): Get metadata for named package
- `version()` (L882): Get version string for named package
- `entry_points()` (L901): Get all entry points, optionally filtered
- `files()` (L916): Get files list for named package
- `requires()` (L925): Get requirements for named package
- `packages_distributions()` (L935): Map top-level packages to distributions

## Architecture Notes
- Uses abstract base classes with concrete filesystem implementations
- Supports both modern wheel (.dist-info) and legacy egg (.egg-info) formats
- Implements caching strategies for performance (FastPath, method_cache)
- Handles multiple metadata sources with fallback logic
- Thread-safe design with immutable data structures where appropriate