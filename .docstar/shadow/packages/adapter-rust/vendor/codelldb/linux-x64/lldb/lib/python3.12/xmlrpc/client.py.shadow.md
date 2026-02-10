# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/xmlrpc/client.py
@source-hash: c77e7072ab9aaab6
@generated: 2026-02-09T18:06:23Z

## XML-RPC Client Library for Python

This is Python's standard XML-RPC client implementation, providing marshalling, unmarshalling, transport, and server proxy functionality for XML-RPC protocol communication over HTTP/HTTPS.

### Core Architecture

**Data Type Wrappers:**
- `DateTime` (L296-377): Wrapper for XML-RPC dateTime values, handles ISO 8601 format conversion from Python datetime objects, time tuples, or timestamps
- `Binary` (L393-427): BASE64 encoder/decoder wrapper for binary data transport over XML-RPC

**Exception Hierarchy:**
- `Error` (L187-189): Base class for all client-side errors
- `ProtocolError` (L201-213): HTTP-level protocol errors (non-200 status codes)
- `ResponseError` (L220-222): Malformed XML-RPC response packages
- `Fault` (L233-241): XML-RPC fault response packages with fault code and string

**Marshalling/Unmarshalling System:**
- `Marshaller` (L472-632): Converts Python data structures to XML-RPC format using type dispatch system
- `Unmarshaller` (L639-828): Converts XML-RPC responses to Python objects using event-driven parsing
- `ExpatParser` (L439-460): XML parser wrapper using expat for performance

**Transport Layer:**
- `Transport` (L1130-351): HTTP transport implementation with connection pooling, gzip support, and authentication
- `SafeTransport` (L1356-380): HTTPS variant with SSL context support
- `GzipDecodedResponse` (L1091-1107): Gzip-compressed response decoder

**Client Interface:**
- `ServerProxy` (L1399-501): Main client class providing transparent method calls to remote XML-RPC servers
- `_Method` (L1113-1122): Magic method dispatcher enabling dot-notation remote method calls
- `MultiCall` (L860-892): Batch execution of multiple XML-RPC calls
- `MultiCallIterator` (L844-858): Iterator for multicall results with fault handling

### Key Functions

**Public API:**
- `dumps()` (L944-1008): Converts Python data to XML-RPC request/response format
- `loads()` (L1019-1031): Converts XML-RPC packet to Python objects
- `getparser()` (L905-929): Creates fastest available parser/unmarshaller pair
- `gzip_encode()/gzip_decode()` (L1041-1082): Gzip compression utilities

### Protocol Constants

Error codes (L165-179) follow XML-RPC specification ranges:
- Parse errors (-32700)
- Server errors (-32600) 
- Application errors (-32500)
- System errors (-32400)
- Transport errors (-32300)

Integer limits (L158-159): MAXINT/MININT for 32-bit XML-RPC integer validation

### Notable Implementation Details

- **Type Dispatch System**: Both Marshaller and Unmarshaller use dispatch dictionaries for type-specific serialization
- **Connection Reuse**: Transport classes maintain connection pools for HTTP/1.1 keep-alive
- **Recursive Protection**: Marshaller tracks object IDs to prevent infinite recursion
- **Platform Compatibility**: DateTime formatting handles cross-platform strftime differences
- **Encoding Handling**: Full UTF-8/XML character reference support
- **Security**: Gzip bomb protection with configurable decode limits