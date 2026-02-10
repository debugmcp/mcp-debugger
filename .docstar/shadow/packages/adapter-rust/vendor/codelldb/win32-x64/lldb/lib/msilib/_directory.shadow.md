# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/msilib/
@generated: 2026-02-09T18:16:15Z

## Overall Purpose
The `msilib` directory provides a comprehensive Python library for creating Microsoft Installer (MSI) packages on Windows platforms. This is a complete MSI authoring toolkit that enables programmatic generation of Windows installation packages with proper database schemas, file packaging, UI dialogs, and installation sequences.

## Key Components and Architecture

### Core Infrastructure (`__init__.py`)
The main module provides high-level abstractions built on the native `_msi` COM interface:
- **Database Management**: Table creation, data insertion, and MSI database operations
- **File Packaging**: Cabinet (CAB) compression and file organization into MSI components
- **Directory Structure**: Physical-to-logical path mapping with Windows 8.3 filename compatibility
- **Feature System**: Hierarchical installation features for selective component installation
- **UI Framework**: Dialog and control classes for installer user interfaces

### Schema Definition (`schema.py`)
Comprehensive MSI database schema registry containing:
- **80+ Standard MSI Tables**: Complete table definitions for ActionText, Feature, Component, File, Directory, Dialog, Control, Registry, Service, and ODBC tables
- **Validation Metadata**: Type constraints, foreign key relationships, and field validation rules
- **Type System**: Encoded field types supporting nullable, key, localizable, and binary field attributes

### Installation Sequences (`sequence.py`)
Predefined action sequences defining installer execution flow:
- **AdminExecuteSequence**: Administrative installation workflow
- **InstallExecuteSequence**: Primary installation with 67 actions covering file operations, registration, service management, and cleanup
- **AdvtExecuteSequence**: Application advertisement without full installation
- **UI Sequences**: User interface action flows for different installation modes

### Text Resources (`text.py`)
Standardized text resources for installer UI:
- **ActionText**: 72 predefined action descriptions with progress templates
- **UIText**: 52 UI element strings including file size units, feature selection feedback, and progress indicators

## Public API Surface

### Primary Entry Points
- `init_database()`: Create new MSI database with product metadata
- `Table()`: Database table schema builder with SQL generation
- `Directory()`: File system abstraction for component-based file packaging
- `CAB()`: Cabinet archive manager for compressed file storage
- `Feature()`: Installation feature definition for selective installation
- `Dialog()` / `Control()`: UI dialog construction system

### File and Component Management
- `Directory.add_file()`: Add files to MSI components with metadata
- `Directory.glob()`: Batch file addition with pattern matching
- `CAB.append()` / `CAB.commit()`: Cabinet compression workflow
- `add_stream()`: Binary stream insertion into MSI database

### Utility Functions
- `make_id()`: Convert strings to valid MSI identifiers
- `gen_uuid()`: Generate MSI-format UUIDs
- `add_data()`: Type-safe record insertion with validation
- `add_tables()`: Bulk schema import from predefined modules

## Internal Organization and Data Flow

### Component-Based Architecture
Files are organized into MSI components for transactional installation/removal. The system maintains:
1. **Physical Structure**: Actual file system paths and cabinet archives
2. **Logical Structure**: MSI identifiers and database relationships
3. **Feature Hierarchy**: Selective installation through feature trees

### Database Generation Flow
1. **Schema Creation**: Tables instantiated from `schema.py` definitions
2. **Data Population**: Files, directories, and metadata inserted using type validation
3. **Cabinet Compression**: Files compressed into CAB archives and stored as binary streams
4. **Sequence Integration**: Installation actions ordered using `sequence.py` definitions
5. **Text Localization**: UI strings applied from `text.py` resources

## Important Patterns and Conventions

### MSI Standards Compliance
- **8.3 Filename Compatibility**: Automatic short filename generation for Windows compatibility
- **Component Rules**: One component per directory with proper keypath management
- **Cabinet Integration**: Files stored in compressed CAB format within MSI database
- **Conditional Actions**: Installation actions with platform and state conditions

### Python Integration
- **Type Safety**: MSI field type validation using encoded type constants
- **Global State Management**: Feature context tracking and directory uniqueness enforcement
- **Platform Detection**: AMD64 architecture support with proper MSI property configuration

### Deprecation Status
The module includes deprecation warnings indicating removal in Python 3.13, suggesting this is legacy infrastructure maintained for backward compatibility.

## Dependencies and Integration
- **Native Interface**: Built on `_msi` module providing COM interface to Windows Installer APIs
- **Schema Coordination**: All components reference common table definitions and validation rules
- **Resource Integration**: Text resources automatically applied to generated installer dialogs and progress displays