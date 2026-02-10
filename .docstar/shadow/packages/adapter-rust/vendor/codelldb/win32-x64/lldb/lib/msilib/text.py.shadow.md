# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/msilib/text.py
@source-hash: fe5bc6023fc58e01
@generated: 2026-02-09T18:11:10Z

## MSI Installer Text Resources

This module provides predefined text strings for MSI (Microsoft Installer) packages, containing user-visible messages displayed during installation and uninstallation processes.

**Primary Purpose:** Supplies standardized text resources for MSI installer user interface components and action descriptions.

### Key Data Structures

**ActionText (L3-74):** List of tuples defining text descriptions for MSI installer actions. Each tuple contains:
- Action name (string)
- Brief description (string) 
- Optional detailed template with placeholders (string or None)

Contains 72 predefined installer actions covering:
- File operations: InstallFiles, RemoveFiles, MoveFiles, PatchFiles
- Registry operations: WriteRegistryValues, RemoveRegistryValues
- Service management: InstallServices, DeleteServices, StartServices, StopServices
- Component registration: RegisterClassInfo, UnregisterClassInfo
- Feature publishing: PublishFeatures, UnpublishFeatures
- System integration: CreateShortcuts, RemoveShortcuts

**UIText (L76-127):** List of tuples defining user interface text elements. Each tuple contains:
- UI element identifier (string)
- Display text (string or None)

Contains 52 UI text entries for:
- File size units: bytes, KB, MB, GB
- Installation state descriptions: MenuLocal, MenuNetwork, MenuCD
- Feature selection feedback: SelLocalLocal, SelAdvertiseAbsent, etc.
- Progress indicators: ScriptInProgress, TimeRemaining
- Disk space information: VolumeCostAvailable, VolumeCostRequired

### Dependencies
- `msilib`: Windows Installer library (L1)
- `os`: File system operations (L1)

### Module Variables
**tables (L129):** List containing the names of the two main data structures, likely used for programmatic access to table definitions.

**dirname (L1):** Directory path of current file, computed but unused in this module.

### Usage Pattern
This module follows the MSI database table schema where text resources are stored as lists of tuples that can be directly inserted into MSI database tables. The placeholder syntax [1], [2], etc. allows for runtime string formatting during installation.