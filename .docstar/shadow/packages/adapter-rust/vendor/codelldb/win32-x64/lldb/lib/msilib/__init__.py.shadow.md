# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/msilib/__init__.py
@source-hash: d024165f8b2d90e2
@generated: 2026-02-09T18:11:26Z

## Primary Purpose
MSI (Microsoft Installer) package creation library providing high-level abstractions for building Windows installation packages. Imports from native `_msi` module and provides Python-friendly interfaces for database schema creation, file packaging, and installer dialog construction.

## Architecture & Dependencies
- **Core dependency**: `_msi` module (L3) - native MSI COM interface
- **Platform detection**: AMD64 architecture detection (L13-15)
- **Deprecation warning**: Module scheduled for removal in Python 3.13 (L11)

## Key Constants & Type System (L17-32)
MSI field type definitions from Wine project:
- Data size masks and type flags for database schema validation
- Field types: `type_long`, `type_short`, `type_string`, `type_binary`
- Field modifiers: `type_nullable`, `type_key`, `type_localizable`

## Core Classes

### Table (L34-87)
Database table schema builder with SQL generation capability.
- `add_field(index, name, type)` (L39): Add typed field to schema
- `sql()` (L42): Generate CREATE TABLE SQL with proper MSI type mapping
- `create(db)` (L84): Execute table creation in MSI database

### Directory (L226-399)
File system directory abstraction for MSI packaging.
- Constructor (L227): Links physical/logical paths, manages components
- `start_component()` (L261): Create MSI component for file grouping
- `add_file()` (L331): Add file to current component with metadata
- `make_short()` (L290): Generate 8.3 short filenames for compatibility
- `glob()` (L380): Batch add files matching pattern
- `remove_pyc()` (L395): Add .pyc cleanup rules

### CAB (L190-223)
Cabinet file manager for compressed file storage.
- `append()` (L206): Add file to cabinet archive
- `commit()` (L215): Write cabinet to temp file and add to MSI database
- `gen_id()` (L197): Generate unique logical file identifiers

### Feature (L406-417)
MSI feature definition for selective installation.
- Constructor adds to Feature table with hierarchy support
- `set_current()` (L415): Set as active feature for subsequent operations

### Dialog/Control Classes (L419-484)
UI dialog system for installer interface.
- **Dialog** (L452): Main dialog container
- **Control** (L419): Base control with event handling
- **RadioButtonGroup** (L437): Specialized radio button container

## Key Functions

### Database Operations
- `init_database()` (L136): Create new MSI database with product metadata
- `add_data()` (L102): Insert records into MSI tables with type validation
- `add_stream()` (L129): Add binary streams (files) to database
- `add_tables()` (L175): Bulk import table data from modules

### Utility Functions
- `make_id()` (L179): Convert strings to valid MSI identifiers
- `gen_uuid()` (L187): Generate MSI-format UUIDs
- `change_sequence()` (L90): Modify action sequences in installer logic

## Critical Patterns
- **Component-based file organization**: Files grouped into components for transactional install/uninstall
- **Dual naming system**: Long/short filename pairs for Windows compatibility
- **Cabinet compression**: Files stored in compressed CAB format within MSI
- **Feature hierarchy**: Selective installation through feature trees
- **SQL-based schema**: MSI uses SQL-like database with custom type system

## Global State
- `current_feature`: Global variable tracking active feature context
- `_directories`: Module-level set preventing duplicate logical directory names

## MSI Constants Integration
Relies heavily on constants from `_msi` module (MSICOLINFO_NAMES, MSIDBOPEN_CREATE, etc.) for database operations and property IDs.