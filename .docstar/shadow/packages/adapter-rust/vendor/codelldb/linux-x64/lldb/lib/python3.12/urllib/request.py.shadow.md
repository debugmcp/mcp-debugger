# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/urllib/request.py
@source-hash: 94897f6f53f96839
@generated: 2026-02-09T18:06:30Z

## Primary Purpose
Core Python module providing an extensible URL opening library supporting HTTP, HTTPS, FTP, file, and data protocols. Implements the classic `urlopen()` interface and object-oriented handler architecture for protocol-specific operations.

## Key Architecture

### Main Entry Points
- `urlopen()` (L138-215): Primary interface accepting URL string or Request object, returns file-like response
- `build_opener()` (L565-599): Factory function creating OpenerDirector with custom handler configuration
- `install_opener()` (L217-219): Sets global default opener
- `urlretrieve()` (L222-280): Downloads URL to local file with progress reporting

### Core Classes

**Request (L313-421)**: Encapsulates HTTP request state
- Properties: `full_url`, `data`, `headers`, `method`
- URL parsing and proxy handling via `_parse()` (L370-376)
- Header management with redirected/unredirected distinction

**OpenerDirector (L422-560)**: Central coordinator managing handler chain
- Handler registration by protocol/condition in `add_handler()` (L434-479)
- Request processing pipeline in `open()` (L496-523)
- Chain-of-responsibility pattern via `_call_chain()` (L485-494)

**BaseHandler (L601-618)**: Abstract base for protocol handlers
- Handler ordering via `handler_order` attribute
- Parent director reference for handler cooperation

### Protocol Handlers

**HTTP/HTTPS Handlers**:
- `AbstractHTTPHandler` (L1252-1367): Core HTTP request/response logic
- `HTTPHandler` (L1370-1375): Plain HTTP implementation  
- `HTTPSHandler` (L1379-1397): SSL/TLS HTTP implementation
- Request preprocessing in `do_request_()` (L1265-1301)
- Connection management in `do_open()` (L1303-1367)

**Authentication Handlers**:
- `AbstractBasicAuthHandler` (L935-1043): HTTP Basic auth with realm parsing
- `HTTPBasicAuthHandler` (L1046-1054): Standard basic auth (401 responses)
- `ProxyBasicAuthHandler` (L1057-1070): Proxy basic auth (407 responses)
- `AbstractDigestAuthHandler` (L1076-1220): HTTP Digest auth implementation
- Password management via `HTTPPasswordMgr` family (L830-933)

**Other Protocol Handlers**:
- `FileHandler` (L1475-1525): Local file:// URL handling
- `FTPHandler` (L1532-1584): FTP protocol with connection caching
- `CacheFTPHandler` (L1589-1641): FTP with connection pooling/timeouts
- `DataHandler` (L1642-1671): RFC 2397 data: URL support
- `ProxyHandler` (L787-829): Generic proxy support

### Error and Redirect Handling
- `HTTPErrorProcessor` (L620-636): Converts HTTP errors to exceptions
- `HTTPDefaultErrorHandler` (L637-639): Raises HTTPError for error responses  
- `HTTPRedirectHandler` (L641-752): Handles 301/302/303/307/308 redirects with loop detection

### Legacy Interface
- `URLopener` (L1695-2143): Original urllib interface (deprecated)
- `FancyURLopener` (L2145-2362): Extended version with auth/redirect handling
- Maintained for backward compatibility with deprecation warnings

## Proxy Support
- Environment variable detection (`getproxies_environment()` L2505-2540)
- Platform-specific proxy configuration (Windows registry, macOS SystemConfiguration)
- Proxy bypass logic with pattern matching (L2542-2664)
- Authentication via Proxy-Authorization headers

## Key Dependencies
- `http.client` for HTTP protocol implementation
- `urllib.parse` for URL parsing utilities
- `urllib.error` for exception types
- `ssl` module for HTTPS support (optional)
- Platform modules: `winreg` (Windows), `_scproxy` (macOS)

## Critical Design Patterns
- **Chain of Responsibility**: Handler processing via `_call_chain()`
- **Strategy Pattern**: Pluggable handlers for different protocols
- **Template Method**: Abstract handler base with concrete implementations
- **Factory Pattern**: `build_opener()` for opener construction
- **Singleton Pattern**: Global `_opener` instance

## Threading & Concurrency
- Module generally not thread-safe (shared global state, caches)
- FTP connection caching explicitly noted as not thread-safe (L2072)
- Individual Request objects safe for single-thread use