# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/iterators.py
@source-hash: 1080a2d03779176d
@generated: 2026-02-09T18:10:33Z

## Purpose
Email message iteration utilities providing various strategies to traverse and extract content from email message objects. Part of Python's email package, designed to work with email.message.Message objects.

## Key Functions

**walk(self) (L19-28)**
- Core tree traversal method intended to become a Message class method
- Performs depth-first traversal of email message tree structure
- Generator that yields the message itself first, then recursively walks multipart subparts
- Uses `self.is_multipart()` and `self.get_payload()` to navigate message hierarchy

**body_line_iterator(msg, decode=False) (L32-40)**
- Extracts text payloads from message parts line-by-line
- Uses walk() to traverse all message parts
- Calls `subpart.get_payload(decode=decode)` to retrieve content
- Yields lines from StringIO wrapper only for string payloads
- Optional decode parameter passed through to get_payload()

**typed_subpart_iterator(msg, maintype='text', subtype=None) (L43-53)**
- Filters message parts by MIME type
- Defaults to maintype='text', optional subtype filtering
- Uses `get_content_maintype()` and `get_content_subtype()` for type checking
- Yields only matching subparts from the message tree

**_structure(msg, fp=None, level=0, include_default=False) (L56-68)**
- Debug utility for visualizing message structure
- Recursively prints indented content types to stdout or specified file
- Uses 4-space indentation per level
- Optional include_default parameter shows default content types
- Not included in __all__ exports (debugging API)

## Dependencies
- `io.StringIO` for line-by-line text iteration
- `sys` for stdout access in debug function
- Assumes email.message.Message interface with methods: is_multipart(), get_payload(), get_content_maintype(), get_content_subtype(), get_content_type(), get_default_type()

## Module Interface
- Exports: body_line_iterator, typed_subpart_iterator, walk
- _structure intentionally excluded from public API

## Architecture Notes
- walk() designed as future Message method (comment L18)
- Functions imported into Iterators.py interface module (comment L31)
- Follows generator pattern for memory efficiency
- Consistent use of message.walk() for traversal in iterator functions