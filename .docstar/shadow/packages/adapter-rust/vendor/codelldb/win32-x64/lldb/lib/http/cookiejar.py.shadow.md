# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/http/cookiejar.py
@source-hash: 2a64dbc46edd0173
@generated: 2026-02-09T18:11:18Z

**HTTP Cookie Handling Library**

This module provides comprehensive HTTP cookie management for web clients, implementing both Netscape and RFC 2965/2109 cookie standards. It handles cookie parsing, storage, expiration, domain matching, and persistence to various file formats.

## Core Classes

**Cookie (L743-839)**: Represents an HTTP cookie with all standard and non-standard attributes. Key methods:
- `__init__()` (L761-802): Initializes cookie with version, name, value, domain, path, security flags, expiration
- `is_expired()` (L810-814): Checks if cookie has expired
- `has_nonstandard_attr()` (L803-808): Manages custom cookie attributes

**CookieJar (L1246-1771)**: Main cookie storage and management container. Key methods:
- `add_cookie_header()` (L1356-388): Adds appropriate Cookie headers to HTTP requests
- `extract_cookies()` (L1680-691): Extracts and stores cookies from HTTP responses
- `make_cookies()` (L1599-652): Factory method that parses Set-Cookie headers into Cookie objects
- `set_cookie()` (L1667-679): Stores a cookie in the internal structure
- `clear_expired_cookies()` (L1734-751): Removes expired cookies from storage
- Internal storage: `_cookies` dict organized as `{domain: {path: {name: cookie}}}`

**CookiePolicy (L841-872)**: Abstract base class defining cookie acceptance rules
- `set_ok()` (L850-857): Determines if cookie should be accepted from server
- `return_ok()` (L859-861): Determines if cookie should be sent to server

**DefaultCookiePolicy (L874-1226)**: Standard implementation of cookie acceptance rules with extensive validation:
- `set_ok()` (L949-966): Comprehensive cookie acceptance validation
- Domain validation (L1015-1073): RFC-compliant domain matching and security checks
- Port validation (L1075-1094): Ensures cookies only sent to appropriate ports
- Security checks for third-party cookies, secure protocols, expired cookies

## File Persistence Classes

**FileCookieJar (L1776-1829)**: Abstract base for file-based cookie storage
- `load()` (L1795-802): Loads cookies from file
- `save()` (L1791-793): Abstract method for saving cookies
- `revert()` (L1804-828): Reloads cookies from file, preserving state on failure

**LWPCookieJar (L1859-1978)**: LibWWW-Perl format implementation
- Saves in "Set-Cookie3" format with full RFC 2965 cookie information
- `as_lwp_str()` (L1872-886): Converts cookies to LWP string format
- `_really_load()` (L1903-977): Parses LWP format files

**MozillaCookieJar (L1980-2121)**: Mozilla/Netscape cookies.txt format
- `_really_load()` (L2012-2080): Parses Netscape format with HttpOnly support
- `save()` (L2082-2121): Saves in tab-separated Netscape format
- Handles HttpOnly cookies via "#HttpOnly_" prefix (L2027-2029)

## Utility Functions

**Date/Time Handling (L80-334)**:
- `http2time()` (L232-286): Parses HTTP date formats to epoch seconds
- `iso2time()` (L306-333): Parses ISO 8601 dates
- `time2netscape()` (L113-130): Formats time for Netscape cookies
- `_str2time()` (L150-204): Core date parsing with timezone support

**Header Processing (L336-532)**:
- `split_header_words()` (L348-431): Parses cookie headers into key-value pairs
- `parse_ns_headers()` (L466-531): Specialized Netscape cookie header parser
- `join_header_words()` (L434-457): Reconstructs header strings from parsed data

**Domain/Path Utilities (L534-741)**:
- `domain_match()` (L550-587): RFC 2965 domain matching algorithm
- `request_host()` (L620-634): Extracts host from request
- `request_path()` (L647-655): Extracts path from request
- `is_third_party()` (L726-740): Determines if request is third-party

## Key Constants

- `NETSCAPE_MAGIC_RGX` (L56): Regex for Netscape cookie file detection
- `HTTPONLY_PREFIX` (L54): "#HttpOnly_" prefix for HttpOnly cookies
- `DEFAULT_HTTP_PORT` (L55): Standard HTTP port "80"

## Threading

The CookieJar uses `_threading.RLock()` (L1266) for thread-safe cookie operations, with locks acquired in methods like `add_cookie_header()`, `extract_cookies()`, and `clear_expired_cookies()`.

## Error Handling

- `LoadError` (L1774): Exception for cookie file loading failures
- `_warn_unhandled_exception()` (L66-74): Debug helper for unexpected exceptions during parsing