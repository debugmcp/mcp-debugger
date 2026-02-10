# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xmlrpc/client.py
@source-hash: c77e7072ab9aaab6
@generated: 2026-02-09T18:11:42Z

## XML-RPC Client Library

This file implements a comprehensive XML-RPC client interface for Python, providing marshalling, unmarshalling, and transport capabilities for XML-RPC protocol communication.

### Core Purpose
Provides XML-RPC client functionality with support for various data types, authentication, compression, and both HTTP/HTTPS transport. Can also be used to implement XML-RPC servers through its marshalling components.

### Key Classes

**Exception Hierarchy (L187-241)**
- `Error` (L187): Base class for all client-side errors
- `ProtocolError` (L201): HTTP-level protocol errors with status codes
- `ResponseError` (L220): Malformed XML-RPC response packages
- `Fault` (L233): XML-RPC fault responses with fault codes and strings

**Data Type Wrappers (L296-433)**
- `DateTime` (L296): ISO 8601 datetime wrapper with comparison methods and time tuple conversion
- `Binary` (L393): Base64-encoded binary data wrapper for transporting arbitrary bytes

**XML Processing (L439-461, L472-632, L639-829)**
- `ExpatParser` (L439): Fast XML parser using expat for Python 2.0+
- `Marshaller` (L472): Converts Python data structures to XML-RPC format with type dispatch system
- `Unmarshaller` (L639): Converts XML-RPC responses back to Python objects with element handlers

**Multi-call Support (L833-892)**
- `_MultiCallMethod` (L833): Helper for collecting multiple method calls
- `MultiCallIterator` (L844): Iterator over multicall results with fault handling
- `MultiCall` (L860): Batches multiple XML-RPC calls into single request

**Transport Layer (L1130-381, L1356-380)**
- `Transport` (L1130): HTTP transport with connection pooling, compression, and authentication
- `SafeTransport` (L1356): HTTPS transport extending Transport with SSL context support

**Client Interface (L1399-504)**
- `ServerProxy` (L1399): Main client class providing virtual connection to XML-RPC server with method dispatch

### Key Functions

**Utility Functions (L905-1082)**
- `getparser()` (L905): Factory for fastest available parser/unmarshaller pair
- `dumps()` (L944): Converts Python objects to XML-RPC request/response packets
- `loads()` (L1019): Converts XML-RPC packets back to Python objects
- `gzip_encode()`/`gzip_decode()` (L1041, L1065): Compression utilities for payload optimization

**Internal Helpers (L149-295)**
- `escape()` (L149): XML entity escaping for safe content
- `_strftime()` (L285): DateTime formatting with cross-platform compatibility
- `_iso8601_format()` (L273-280): Platform-specific ISO 8601 formatting

### Architecture Patterns

**Type Dispatch System**: Marshaller uses dispatch dictionary mapping Python types to serialization methods (L491, L542-632)

**Parser Factory Pattern**: `getparser()` selects optimal parser implementation based on availability (L905-929)

**Connection Pooling**: Transport classes maintain connection cache for HTTP/1.1 keep-alive (L1148, L1249-257)

**Method Proxy Pattern**: `_Method` class enables natural method call syntax on remote procedures (L1113-1122)

### Dependencies
- `http.client`, `urllib.parse`: HTTP transport
- `xml.parsers.expat`: XML parsing
- `base64`: Binary data encoding
- `gzip`: Optional compression support
- `datetime`, `decimal`: Extended data type support

### Constants
- XML-RPC integer limits: `MAXINT`/`MININT` (L158-159)
- Error codes following XML-RPC specification (L166-179)
- Version string derived from Python version (L155)

### Compatibility Notes
- Designed for Python 2.1+ (historical, now Python 3)
- Handles platform differences in datetime formatting (L265-282)
- Graceful fallback when gzip unavailable (L141-144)
- Fast parser fallback to ExpatParser when C extensions unavailable (L897, L923-928)