# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/policy.py
@source-hash: a183dd9d170a9c38
@generated: 2026-02-09T18:10:36Z

**Primary Purpose:**
Email policy implementation that provides advanced header parsing, folding algorithms, and UTF-8 support for email messages. This module implements the email6 features with provisional APIs for enhanced email handling.

**Key Classes and Functions:**

- **EmailPolicy (L27-224)**: Core policy class extending base Policy with enhanced header handling
  - Implements RFC 2047 and 5322 compliant folding algorithms
  - Provides custom header objects instead of simple strings
  - Key attributes: `utf8`, `refold_source`, `header_factory`, `content_manager`
  - `__init__` (L93-98): Ensures unique header factory per instance
  - `header_max_count` (L100-106): Returns max count from specialized header class
  - `header_source_parse` (L118-129): Parses headers from source lines
  - `header_store_parse` (L131-148): Validates and processes headers for storage
  - `header_fetch_parse` (L150-163): Retrieves and processes headers for access
  - `fold` (L165-184): Controls header folding based on refold_source policy
  - `fold_binary` (L186-202): Binary-safe folding with encoding options
  - `_fold` (L204-223): Internal folding implementation with refold logic

**Key Dependencies:**
- `email._policybase`: Base Policy classes and compatibility layer
- `email.headerregistry.HeaderRegistry`: Header factory for custom header objects
- `email.contentmanager.raw_data_manager`: Default content management
- `email.message.EmailMessage`: Message factory class

**Global Variables:**
- `linesep_splitter` (L24): Regex for splitting line separators
- `default` (L226): Default EmailPolicy instance
- `strict` (L229): Strict policy variant with raise_on_defect=True
- `SMTP` (L230): SMTP-compatible policy with \r\n line endings
- `HTTP` (L231): HTTP-compatible policy with no max line length
- `SMTPUTF8` (L232): SMTP policy with UTF-8 support

**Architecture Patterns:**
- Factory pattern: Uses header_factory for creating specialized header objects
- Policy pattern: Different policies (default, strict, SMTP, HTTP) for various use cases
- Lazy evaluation: Expensive RFC5322 parsing deferred until needed
- Compatibility layer: Maintains consistency with Compat32 for library interoperability

**Critical Invariants:**
- Header values cannot contain linefeed or carriage return characters (enforced in L143-147)
- Each EmailPolicy instance gets unique header factory to avoid shared state issues
- Binary data triggers refolding regardless of refold_source setting
- UTF-8 vs ASCII encoding controlled by utf8 attribute