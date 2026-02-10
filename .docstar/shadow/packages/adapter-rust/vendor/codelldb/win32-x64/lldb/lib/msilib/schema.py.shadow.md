# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/msilib/schema.py
@source-hash: a7d6c1a4699a75bb
@generated: 2026-02-09T18:11:14Z

**MSI Database Schema Definition Module**

This module defines the complete schema for Microsoft Installer (MSI) database tables, providing programmatic access to MSI table structures and validation metadata.

## Primary Purpose
Generates MSI database table schemas by creating Table objects with field definitions and validation records. Acts as a centralized schema registry for MSI package creation and manipulation.

## Key Components

### Table Creation Pattern (L3-579)
- **_Validation Table** (L3-13): Core validation metadata table defining constraints for all other tables
- **Standard MSI Tables** (L15-579): Complete set of 80+ MSI tables including:
  - **ActionText** (L15-18): Action descriptions for progress dialogs
  - **Feature/Component Tables** (L79-136): Core installation feature and component definitions
  - **File/Directory Tables** (L97-168): File system structure and file metadata
  - **Control/Dialog Tables** (L169-208): UI element definitions
  - **Registry/Environment Tables** (L445-237): System configuration tables
  - **Service/ODBC Tables** (L495-414): Windows service and database connectivity

### Schema Structure
Each table follows consistent pattern:
1. Table instantiation: `Table('TableName')`
2. Field addition: `add_field(position, name, type_code)`
3. Type codes appear to encode field constraints (nullable, size, data type)

### Global Collections
- **tables** list (L580): Complete registry of all 80 table objects
- **_Validation_records** tuple (L582-1007): Comprehensive validation metadata with:
  - Table/column names and nullability constraints
  - Data type categories and value ranges
  - Foreign key relationships
  - Human-readable descriptions

## Architecture Notes
- **Declarative Schema**: Tables defined statically rather than dynamically generated
- **Type System**: Numeric codes (e.g., 11552, 3332) encode field type and constraint information
- **Validation Integration**: _Validation table provides self-documenting schema with constraints
- **MSI Compliance**: Schema matches official Microsoft Installer specification

## Dependencies
- Imports `Table` class from parent module (L1)
- No external dependencies beyond local Table implementation

## Usage Context
This schema definition enables:
- MSI package creation with proper table structures
- Database validation during MSI operations  
- Schema introspection for MSI manipulation tools
- Type-safe database operations with constraint checking