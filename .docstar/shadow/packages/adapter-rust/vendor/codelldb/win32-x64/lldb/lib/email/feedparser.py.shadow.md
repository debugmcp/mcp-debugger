# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/feedparser.py
@source-hash: 6046239fcdd6977d
@generated: 2026-02-09T18:10:39Z

## Email Feed Parser Module

This module implements incremental email message parsing for Python's email package, designed for streaming applications where email data arrives line-by-line (e.g., from sockets).

### Core Classes

**BufferedSubFile (L44-132)**
- File-like buffering object managing partial lines and complete lines via deque
- Implements EOF predicate stack for nested parsing contexts (multipart boundaries)
- Key methods:
  - `push(data)` (L100-119): Accepts incremental data, splits on newlines while preserving partial lines
  - `readline()` (L77-93): Returns lines or `NeedMoreData` sentinel when buffer empty
  - `push_eof_matcher(pred)` (L63): Adds boundary predicate to stack for false EOF detection

**FeedParser (L134-528)**
- Main incremental parser using generator-based state machine via `_parsegen()` (L216-467)
- Handles all email content types: simple messages, multipart, message/*, message/delivery-status
- Key methods:
  - `feed(data)` (L171-174): Primary interface for pushing data
  - `close()` (L182-193): Finalizes parsing and returns root message
  - `_parse_headers(lines)` (L469-528): RFC 2822 header parsing with continuation line support

**BytesFeedParser (L530-534)**
- Thin wrapper around FeedParser that decodes bytes to text using ASCII with surrogate escapes

### Key Architecture Patterns

**Generator-Based Parsing**
- `_parsegen()` yields `NeedMoreData` when more input required, enabling incremental processing
- Recursive calls handle nested message structures (multipart subparts, message/* types)

**Error Handling Strategy**
- Never raises parsing exceptions; instead adds "defects" to message objects
- Policy object controls defect handling behavior (L145, L192, etc.)

**Message Stack Management**
- `_msgstack` maintains parsing context for nested structures
- `_new_message()` (L195-206) and `_pop_message()` (L208-214) manage hierarchy

### Dependencies
- `email.errors`: Defect classes for malformed content
- `email._policybase.compat32`: Default parsing policy
- `collections.deque`: Efficient line buffering
- `io.StringIO`: Partial line accumulation

### Critical Patterns
- Boundary detection regex compilation (L330-332) for multipart parsing
- Newline normalization handling across different line ending formats
- RFC 2822 header continuation line processing (L475-484)
- Unix-from envelope header special handling (L489-508)

### Message Type Handlers
- **Multipart**: Boundary-based parsing with preamble/epilogue handling (L303-458)
- **Message types**: Recursive parsing for nested RFC 2822 messages (L293-302)
- **Delivery status**: Special multi-header-block parsing (L254-292)
- **Simple types**: Direct payload capture (L459-467)