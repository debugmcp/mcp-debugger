# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/_policybase.py
@source-hash: f54638e6cb776d28
@generated: 2026-02-09T18:10:34Z

**Primary Purpose:** Framework for email parsing and formatting policies that provides fine-grained control over how the email package interprets and renders message data.

**Core Architecture:**

The module implements a three-tier hierarchy:

1. **_PolicyBase (L18-92)** - Abstract base providing immutable object framework with cloning capabilities
2. **Policy (L112-277)** - Abstract policy interface defining email-specific controls  
3. **Compat32 (L280-380)** - Concrete policy implementation for backward compatibility

**Key Components:**

**_PolicyBase Class (L18-92):**
- Immutable object pattern with keyword-based construction (L41-53)
- `clone()` method (L60-76) for creating modified instances
- Operator overloading: `__add__` (L85-91) for policy composition
- Read-only attributes enforced via `__setattr__` (L78-83)

**Policy Abstract Class (L112-277):**
- Configuration attributes (L169-175): `raise_on_defect`, `linesep`, `cte_type`, `max_line_length`, `mangle_from_`, `message_factory`, `verify_generated_headers`
- Defect handling: `handle_defect()` (L177-194) and `register_defect()` (L196-207)
- Header count limits: `header_max_count()` (L209-226)
- Abstract methods for header processing:
  - `header_source_parse()` (L228-236) - parsing from source lines
  - `header_store_parse()` (L238-243) - storing application values
  - `header_fetch_parse()` (L245-254) - retrieving for application
  - `fold()` (L256-266) - text header folding
  - `fold_binary()` (L268-276) - binary header folding

**Compat32 Implementation (L280-380):**
- Extends Policy with `mangle_from_ = True` (L287)
- Implements all abstract methods for Python 2/3 compatibility
- `_sanitize_header()` (L289-299) - handles surrogate-escaped binary data
- `_fold()` (L348-379) - core folding logic using Header class
- Binary data handling via `unknown-8bit` charset encoding

**Utility Functions:**
- `_append_doc()` (L94-97) - docstring concatenation helper
- `_extend_docstrings()` (L99-109) - metaclass decorator for docstring inheritance

**Dependencies:**
- `abc` module for abstract base class functionality
- `email.header` and `email.charset` for header processing
- `email.utils._has_surrogates` for binary data detection

**Key Patterns:**
- Immutable configuration objects with functional-style updates
- Abstract method pattern for pluggable header processing
- Decorator-based docstring inheritance system
- Graceful handling of surrogate-escaped binary data in headers

**Module Exports (L11-15):** `Policy`, `Compat32`, `compat32` instance

**Critical Invariants:**
- Policy objects are immutable after construction
- All header processing methods must handle surrogate-escaped data
- `compat32` provides the default backward-compatible behavior