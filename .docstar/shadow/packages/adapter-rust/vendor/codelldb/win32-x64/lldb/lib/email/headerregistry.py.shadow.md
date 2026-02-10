# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/headerregistry.py
@source-hash: fada56c25b6a457c
@generated: 2026-02-09T18:10:42Z

This module provides an email header representation system following RFC5322 standards. It implements a flexible header registry and parsing system for email messages.

## Core Classes

**Address (L12-102)**: Represents a single email address with display name, username, and domain components. Can be constructed either from separate components or from an addr_spec string. Provides RFC5322-compliant string formatting and property access to components.

**Group (L104-152)**: Represents a group of addresses or a single address container. Used for address lists in headers like To, From, CC. Handles display_name followed by colon and semicolon-terminated address lists.

## Header Infrastructure

**BaseHeader (L156-254)**: Abstract base class for all header types. Implements the core header parsing contract:
- Requires subclasses to define `parse()` classmethod that populates parse_tree, decoded value, and defects
- Provides `fold()` method for RFC5322-compliant header folding
- Handles surrogate escaping and content transfer encoding
- Uses `__new__` pattern to create immutable string-based header objects

## Header Type Hierarchy

**UnstructuredHeader (L260-269)**: Base for headers with free-form text content (Subject, Comments)
- **UniqueUnstructuredHeader (L271-274)**: max_count=1 variant

**DateHeader (L276-320)**: Handles timestamp headers, provides datetime attribute
- **UniqueDateHeader (L322-325)**: max_count=1 variant  

**AddressHeader (L327-380)**: Handles address list headers (To, From, CC, BCC)
- Converts between RFC parser representation and API Group/Address objects
- **UniqueAddressHeader (L382-385)**: max_count=1 variant
- **SingleAddressHeader (L387-395)**: Must contain exactly one address
- **UniqueSingleAddressHeader (L397-400)**: Combines unique and single constraints

**MIME Headers**:
- **MIMEVersionHeader (L402-437)**: Parses version strings, provides major/minor properties
- **ParameterizedMIMEHeader (L439-466)**: Base mixin for headers with parameters dict
- **ContentTypeHeader (L468-488)**: Extends parameterized, provides maintype/subtype/content_type
- **ContentDispositionHeader (L490-502)**: Extends parameterized for disposition headers
- **ContentTransferEncodingHeader (L504-523)**: Handles CTE headers, provides cte property
- **MessageIDHeader (L525-535)**: Handles message ID parsing

## Header Registry System

**HeaderRegistry (L562-604)**: Factory class that creates header instances
- Maps header names to specialized classes via registry dict (L578)
- Creates dynamic classes combining base_class with specialized behavior (L592)
- Default mappings defined in `_default_header_map` (L539-560)
- `__call__()` method creates header instances from name/value pairs

## Dependencies
- `email.utils`: Date parsing, sanitization utilities
- `email.errors`: Defect classes for parsing issues  
- `email._header_value_parser`: Core RFC5322 parsing functions

## Architecture Notes
- Headers are immutable string subclasses with structured data properties
- Parser populates defects list rather than raising exceptions for robustness
- Uses class composition pattern to combine base functionality with specialized parsing
- Supports both parsing from strings and construction from structured objects