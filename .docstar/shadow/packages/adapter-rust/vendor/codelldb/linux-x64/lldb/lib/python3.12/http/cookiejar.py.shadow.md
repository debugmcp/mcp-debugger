# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/http/cookiejar.py
@source-hash: 2a64dbc46edd0173
@generated: 2026-02-09T18:06:23Z

## HTTP Cookie Handling Module for Web Clients

This module provides comprehensive HTTP cookie management functionality with support for both Netscape and RFC 2965 cookie standards. It handles cookie parsing, policy enforcement, storage, and persistence.

### Core Classes

**Cookie (L743-839)**: Represents an HTTP cookie with all standard attributes (name, value, domain, path, port, secure, expires, etc.) and custom attributes. Key methods:
- `is_expired(now=None)` (L810): Check if cookie has expired
- `has_nonstandard_attr(name)` (L803): Check for custom cookie attributes
- String representations for debugging

**CookiePolicy (L841-872)**: Abstract base class defining cookie acceptance/return policies. Subclasses must implement:
- `set_ok(cookie, request)` (L850): Whether to accept cookie from server
- `return_ok(cookie, request)` (L859): Whether to return cookie to server

**DefaultCookiePolicy (L874-1226)**: Implements standard cookie acceptance rules with extensive configuration options:
- Domain blocking/allowing with `blocked_domains()` (L919) and `allowed_domains()` (L932)
- RFC 2965 vs Netscape protocol support
- Strict domain/path validation in `set_ok_domain()` (L1015) and `set_ok_path()` (L1004)
- Security checks for third-party cookies and unverifiable requests

**CookieJar (L1246-1771)**: Main cookie storage and management class with thread-safe operations:
- `add_cookie_header(request)` (L1356): Add Cookie header to outgoing requests
- `extract_cookies(response, request)` (L1680): Extract cookies from server response
- `make_cookies(response, request)` (L1599): Parse Set-Cookie headers into Cookie objects
- `clear_expired_cookies()` (L1734): Remove expired cookies from storage
- Hierarchical storage: domain → path → name → cookie

### File-Based Cookie Jars

**FileCookieJar (L1776-1829)**: Base class for persistent cookie storage:
- `save()` (L1791): Save cookies to file (abstract)
- `load()` (L1795): Load cookies from file
- `revert()` (L1804): Clear and reload from file

**LWPCookieJar (L1859-1978)**: libwww-perl format (Set-Cookie3) with full RFC 2965 support:
- `as_lwp_str()` (L1872): Export as Set-Cookie3 format string
- `_really_load()` (L1903): Parse LWP format files

**MozillaCookieJar (L1980-2121)**: Mozilla/Netscape cookies.txt format:
- Tab-separated format with HttpOnly prefix support (L2024-2030)
- Downgrades RFC 2965 cookies to Netscape format on save

### Utility Functions

**Date/Time Parsing (L77-334)**:
- `http2time(text)` (L232): Parse HTTP date formats to epoch time
- `iso2time(text)` (L306): Parse ISO 8601 dates
- `time2netscape()` (L113) and `time2isoz()` (L94): Format timestamps

**Header Processing (L336-532)**:
- `split_header_words(header_values)` (L348): Parse structured header values
- `parse_ns_headers(ns_headers)` (L466): Parse Netscape Set-Cookie headers
- `join_header_words(lists)` (L434): Reconstruct header strings

**Domain/Path Utilities (L534-741)**:
- `domain_match(A, B)` (L550): RFC 2965 domain matching algorithm
- `request_host(request)` (L620): Extract host from request
- `request_path(request)` (L647): Extract and escape path component

### Key Patterns

- Thread-safe cookie storage using `_threading.RLock()` (L1266)
- Hierarchical cookie organization for efficient domain/path lookups
- Policy-based architecture allowing custom cookie acceptance rules
- Comprehensive error handling with `_warn_unhandled_exception()` (L66)
- Debug logging system with global `debug` flag (L41)

### Dependencies
- Standard library modules: `os`, `copy`, `datetime`, `re`, `time`, `urllib`, `threading`, `http.client`
- Uses `calendar.timegm` for timestamp conversions

The module provides complete HTTP cookie functionality suitable for web clients, with robust parsing, policy enforcement, and multiple persistence formats.