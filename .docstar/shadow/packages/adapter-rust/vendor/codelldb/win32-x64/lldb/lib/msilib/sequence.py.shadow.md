# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/msilib/sequence.py
@source-hash: a68438bacd41b60c
@generated: 2026-02-09T18:11:15Z

## Primary Purpose
This file defines Windows Installer (MSI) action sequence tables for LLDB installation. It contains predefined sequences of installer actions with their execution order and conditions, used to generate MSI installer packages.

## Key Data Structures

### AdminExecuteSequence (L1-10)
Administrative installation sequence with 8 core actions. Defines file costing, validation, and installation phases for admin-level installs. Key actions include:
- `InstallInitialize` (1500) - starts installation process
- `FileCost` (900) - calculates file installation costs
- `InstallFiles` (4000) - performs file installation
- `InstallFinalize` (6600) - completes installation

### AdminUISequence (L12-20)
Administrative UI sequence with 7 actions for admin installation dialogs. Includes standard exit dialogs (`ExitDialog`, `FatalError`, `UserExit`) with negative sequence numbers (-1, -3, -2) indicating special handling.

### AdvtExecuteSequence (L22-37)
Advertisement sequence with 16 actions for application advertisement without full installation. Focuses on registration actions (L33-36): `RegisterClassInfo`, `RegisterExtensionInfo`, `RegisterMIMEInfo`, `RegisterProgIdInfo`.

### InstallExecuteSequence (L39-106)
Primary installation sequence with 67 comprehensive actions covering full product installation lifecycle:
- **Initialization phase** (L40-46): Cost calculation and validation
- **File operations** (L58-70): Creation, moving, patching of files and folders  
- **Registration phase** (L72-76): COM+, fonts, type libraries, user registration
- **Service management** (L61, 65, 90-91): Install/delete/start/stop services with `VersionNT` conditions
- **Cleanup phase** (L77-101): Removal of duplicate files, registry values, shortcuts
- **Finalization** (L103-105): Environment strings, INI values, registry writing

### InstallUISequence (L108-124)
UI sequence with 17 actions for installation user interface. Combines basic costing (L109-111) with search and validation actions (L116-123).

### Tables List (L126)
String array containing all table names for programmatic access.

## Architectural Patterns

**Tuple Structure**: Each action defined as `(action_name, condition, sequence_number)` tuple where:
- `action_name`: MSI standard action identifier
- `condition`: Install condition (None for unconditional, strings like "NOT Installed", "VersionNT")
- `sequence_number`: Execution order (higher numbers execute later, negative numbers for special cases)

**Sequence Ordering**: Actions follow MSI standard execution patterns - costing before validation, file operations before registration, cleanup before finalization.

**Conditional Execution**: Several actions use conditions like `VersionNT` (Windows NT-based systems) and `NOT Installed` (new installations only).

## Dependencies
Part of Python's `msilib` module ecosystem for MSI package generation. No external imports - pure data definitions consumed by MSI generation tools.