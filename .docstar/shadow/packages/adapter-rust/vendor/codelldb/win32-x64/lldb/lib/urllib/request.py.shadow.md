# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/urllib/request.py
@source-hash: 94897f6f53f96839
@generated: 2026-02-09T18:12:34Z

## urllib.request - URL Opening Library

Core HTTP/URL handling module providing extensible framework for opening URLs across multiple protocols (HTTP, HTTPS, FTP, file, data).

### Primary Architecture

**Main Entry Points:**
- `urlopen()` (L138-215): Primary function accepting URL string or Request object, returns file-like response
- `build_opener()` (L565-599): Creates OpenerDirector with configurable handlers
- `install_opener()` (L217-219): Sets global default opener
- `urlretrieve()` (L222-280): Downloads URL to local file

**Core Classes:**
- `Request` (L313-421): Encapsulates HTTP request state (URL, headers, data, method)
- `OpenerDirector` (L422-560): Manages handler chain and request/response processing
- `BaseHandler` (L601-618): Base class for protocol-specific handlers with ordering system

### Handler Ecosystem

**HTTP/HTTPS Handlers:**
- `AbstractHTTPHandler` (L1252-1367): Base HTTP functionality with connection management
- `HTTPHandler` (L1370-1375): HTTP protocol handler
- `HTTPSHandler` (L1379-1395): HTTPS with SSL context support
- `HTTPErrorProcessor` (L620-635): Processes HTTP error responses
- `HTTPDefaultErrorHandler` (L637-639): Raises HTTPError for non-2xx responses

**Authentication Handlers:**
- `AbstractBasicAuthHandler` (L935-1042): Base for Basic auth with realm parsing
- `HTTPBasicAuthHandler` (L1046-1054): HTTP Basic authentication (401 errors)
- `ProxyBasicAuthHandler` (L1057-1069): Proxy Basic authentication (407 errors)
- `AbstractDigestAuthHandler` (L1076-1220): RFC 2617 Digest authentication
- `HTTPDigestAuthHandler` (L1222-1237): HTTP Digest auth implementation
- `ProxyDigestAuthHandler` (L1240-1250): Proxy Digest auth implementation

**Password Management:**
- `HTTPPasswordMgr` (L830-892): Basic realm/URI-based password storage
- `HTTPPasswordMgrWithDefaultRealm` (L894-901): Fallback to None realm
- `HTTPPasswordMgrWithPriorAuth` (L904-933): Pre-emptive authentication support

**Other Protocol Handlers:**
- `ProxyHandler` (L787-828): Proxy server support with authentication
- `HTTPRedirectHandler` (L641-751): Handles 3xx redirects with loop detection
- `FileHandler` (L1475-1524): Local file:// protocol support
- `FTPHandler` (L1532-1583): FTP protocol with connection caching
- `CacheFTPHandler` (L1589-1640): FTP with persistent connection cache
- `DataHandler` (L1642-1670): RFC 2397 data: URL support
- `HTTPCookieProcessor` (L1399-1415): Cookie jar integration
- `UnknownHandler` (L1417-1420): Fallback for unsupported protocols

### Legacy Interface

**URLopener Classes:**
- `URLopener` (L1695-2143): Legacy interface with deprecation warnings, extensive protocol support
- `FancyURLopener` (L2145-2361): Enhanced URLopener with redirect/auth handling

### Key Patterns

**Handler Registration:** OpenerDirector uses method introspection to register handlers based on naming conventions (`protocol_open`, `http_error_XXX`, etc.) (L440-479)

**Chain of Responsibility:** `_call_chain()` (L485-494) iterates through handlers until one returns non-None

**SSL Context Management:** HTTPS handlers support custom SSL contexts for certificate validation and client authentication

**Proxy Support:** Environment variable detection (`HTTP_PROXY`, etc.) and platform-specific registry/system configuration integration

**Error Handling:** Hierarchical error handling with protocol-specific error codes and fallback mechanisms

### Platform Integration

**Proxy Detection:**
- Unix: Environment variables (L2505-2540)
- macOS: SystemConfiguration framework via `_scproxy` (L2667-2698)
- Windows: Registry-based proxy settings (L2701-2791)

**File Path Conversion:**
- Windows: `nturl2path` integration (L1678-1679)
- Unix: Simple quote/unquote (L1681-1689)

### Utility Functions

- `parse_http_list()/parse_keqv_list()` (L1432-1473): RFC 2068 list parsing for headers
- `request_host()` (L297-311): RFC 2965 host extraction
- `_parse_proxy()` (L754-785): Proxy URL parsing with authority handling