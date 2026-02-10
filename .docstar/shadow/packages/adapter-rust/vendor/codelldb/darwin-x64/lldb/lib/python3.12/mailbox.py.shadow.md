# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/mailbox.py
@source-hash: 1c356f03e8df0b99
@generated: 2026-02-09T18:08:25Z

## Purpose
Python mailbox module providing unified interface for reading/writing various mailbox formats: Maildir, mbox, MH, Babyl, and MMDF. Implements dict-like API for message access with format-specific optimizations and cross-format message conversion capabilities.

## Core Architecture

**Base Classes:**
- `Mailbox` (L34-264): Abstract base class defining common mailbox interface with dict-like operations (add, remove, get, keys, etc.)
- `_singlefileMailbox` (L577-773): Base for single-file formats (mbox, MMDF, Babyl) with TOC-based indexing and atomic write operations
- `Message` (L1494-1529): Base message class extending email.message.Message with format-specific properties

**Mailbox Implementations:**
- `Maildir` (L267-575): qmail-style directory-based format with new/cur/tmp subdirs, uses filesystem for storage
- `mbox` (L843-893): Unix mbox format with "From " line delimiters
- `MMDF` (L895-937): MMDF format using `\001\001\001\001` delimiters
- `MH` (L940-1242): MH format storing each message as separate numbered file
- `Babyl` (L1245-1491): Emacs Rmail format with visible/invisible headers

**Message Types:**
- `MaildirMessage` (L1531-1638): Maildir flags, subdir (new/cur), date properties
- `mboxMessage` (L1753-1755): mbox-specific message wrapper
- `MHMessage` (L1757-1826): MH sequences support
- `BabylMessage` (L1829-1921): Babyl labels and visible headers
- `MMDFMessage` (L1924-1925): MMDF-specific message wrapper

## Key Components

**File Operations:**
- `_ProxyFile` (L1928-2023): Read-only file wrapper with position tracking
- `_PartialFile` (L2026-2062): Read-only wrapper for file segments (inherits _ProxyFile)
- `_lock_file/_unlock_file` (L2065-2112): File locking using fcntl + dotlocks
- `_create_carefully/_create_temporary` (L2114-2126): Safe file creation with exclusive access

**Format Conversion:**
Each message class implements `_explain_to()` method for cross-format conversion, mapping format-specific properties (flags, sequences, labels) between different mailbox types.

**Atomic Operations:**
Single-file mailboxes use write-to-temp-then-rename pattern for atomic updates. Maildir uses filesystem operations for natural atomicity.

## Dependencies
- Standard library: os, time, email, socket, errno, io, contextlib
- Optional: fcntl (for file locking on Unix systems)
- Uses email package for message parsing/generation

## Critical Patterns
- All modifications require explicit flush() calls for persistence
- Single-file formats maintain TOC (table of contents) for message indexing
- Cross-platform newline handling (uses os.linesep)
- Exception hierarchy: Error → NoSuchMailboxError/NotEmptyError/ExternalClashError/FormatError
- Thread-safety through file locking mechanisms