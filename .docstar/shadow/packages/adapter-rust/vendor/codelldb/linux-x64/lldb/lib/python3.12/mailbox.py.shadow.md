# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/mailbox.py
@source-hash: 1c356f03e8df0b99
@generated: 2026-02-09T18:09:50Z

## Python Standard Library Mailbox Module

**Primary Purpose:** Provides read/write support for various mailbox formats including Maildir, mbox, MH, Babyl, and MMDF. Each format has specific storage conventions and message properties.

### Core Architecture

**Base Classes:**
- `Mailbox` (L34-265): Abstract base class defining common mailbox interface with dict-like operations
- `_singlefileMailbox` (L577-773): Base for single-file formats (mbox, MMDF, Babyl)
- `Message` (L1494-1529): Base message class extending `email.message.Message`

### Mailbox Implementations

**Maildir** (L267-575): qmail-style directory-based mailbox
- Uses `tmp/`, `new/`, `cur/` subdirectories (L275-279)
- Messages stored as individual files with unique names
- Supports folders and message flags via filename encoding
- Key methods: `_create_tmp()` (L490), `_refresh()` (L514), `_lookup()` (L550)

**mbox** (L843-893): Traditional Unix mbox format
- Single file with "From " line separators
- Inherits from `_mboxMMDF` (L776-841)
- Message boundaries detected by `_generate_toc()` (L861-892)

**MMDF** (L895-938): Multi-Message Delivery Format
- Uses `\001\001\001\001` delimiters instead of "From " lines
- Similar structure to mbox but different separators

**MH** (L940-1243): MH mail system format
- Directory-based with numbered message files
- Supports sequences (message groups) via `.mh_sequences` file
- Key methods: `get_sequences()` (L1151), `set_sequences()` (L1175), `pack()` (L1204)

**Babyl** (L1245-1492): Rmail-style mailbox
- Complex format with visible/original headers distinction
- Label-based message classification
- Special labels: `{'unseen', 'deleted', 'filed', 'answered', 'forwarded', 'edited', 'resent'}` (L1248-1249)

### Message Classes

**Format-specific message types:**
- `MaildirMessage` (L1531-1638): Supports flags, subdirectory, date metadata
- `_mboxMMDFMessage` (L1640-1751): Handles "From " line and Status/X-Status headers
- `MHMessage` (L1757-1827): Manages sequences list
- `BabylMessage` (L1829-1922): Handles labels and visible headers

**Cross-format conversion:** Each message class implements `_explain_to()` method for converting between formats with appropriate flag/metadata mapping.

### Utility Classes & Functions

**File Proxies:**
- `_ProxyFile` (L1928-2024): Read-only file wrapper with position tracking
- `_PartialFile` (L2026-2063): Handles reading subsections of files

**File Operations:**
- `_lock_file()` (L2065-2105): Uses both fcntl and dot-lock mechanisms
- `_sync_flush()` (L2128-2132): Ensures data written to disk
- `_create_carefully()` (L2114-2120): Atomic file creation

### Dependencies & Platform Handling

- Uses `fcntl` module for file locking when available (L22-25)
- Cross-platform line separator handling via `linesep` (L32)
- Hostname sanitization for unique filename generation (L494-497)

### Key Patterns

1. **Lazy Loading:** TOC (table of contents) generated on-demand and cached
2. **Atomic Operations:** Temporary files used for safe updates, then renamed
3. **Format Abstraction:** Common interface despite different storage mechanisms
4. **Error Handling:** Specific exception types for different failure modes (L2140-2153)