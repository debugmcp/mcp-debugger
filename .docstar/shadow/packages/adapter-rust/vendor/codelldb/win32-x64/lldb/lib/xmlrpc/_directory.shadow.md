# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xmlrpc/
@generated: 2026-02-09T18:16:15Z

## XML-RPC Protocol Implementation Package

This directory provides a complete XML-RPC (Remote Procedure Call) implementation for Python, supporting both client and server functionality with comprehensive protocol handling, transport options, and documentation generation.

### Overall Purpose

The `xmlrpc` package implements the XML-RPC protocol specification, enabling remote procedure calls over HTTP/HTTPS. It serves as part of LLDB's Python bindings infrastructure, specifically supporting remote debugging capabilities through standardized XML-RPC communication protocols.

### Key Components and Architecture

**Client-Side (`client.py`)**:
- **Core Client**: `ServerProxy` class provides the main entry point for making XML-RPC calls to remote servers
- **Data Marshalling**: `Marshaller`/`Unmarshaller` classes handle conversion between Python objects and XML-RPC format
- **Transport Layer**: `Transport`/`SafeTransport` classes manage HTTP/HTTPS communication with connection pooling and compression
- **Protocol Support**: Full XML-RPC data type support including DateTime, Binary, multicall batching, and fault handling

**Server-Side (`server.py`)**:
- **Core Server**: `SimpleXMLRPCServer` provides HTTP-based XML-RPC server with method registration and dispatching
- **Request Handling**: `SimpleXMLRPCRequestHandler` processes incoming XML-RPC requests over HTTP
- **Method Registration**: `SimpleXMLRPCDispatcher` manages function/instance registration and method resolution
- **Multi-path Support**: `MultiPathXMLRPCServer` enables multiple XML-RPC endpoints on different URL paths
- **CGI Deployment**: `CGIXMLRPCRequestHandler` supports XML-RPC in CGI environments

**Documentation Generation**:
- **Auto-documentation**: `XMLRPCDocGenerator` and `DocXMLRPCServer` provide automatic HTML documentation for registered methods
- **Introspection**: Built-in system methods (`system.listMethods`, `system.methodHelp`, `system.methodSignature`) for runtime discovery

### Public API Surface

**Main Entry Points**:
- `ServerProxy(uri)` - Primary client class for connecting to XML-RPC servers
- `SimpleXMLRPCServer(addr, requestHandler)` - Basic XML-RPC server
- `DocXMLRPCServer(addr)` - XML-RPC server with built-in documentation
- `CGIXMLRPCRequestHandler()` - CGI-based XML-RPC handler

**Utility Functions**:
- `dumps(params, methodname)` - Serialize Python objects to XML-RPC format
- `loads(data)` - Deserialize XML-RPC data to Python objects
- `getparser()` - Factory for optimal parser/unmarshaller pairs

**Data Type Wrappers**:
- `DateTime` - ISO 8601 datetime handling
- `Binary` - Base64-encoded binary data transport
- `Fault` - XML-RPC fault/error representation

### Internal Organization and Data Flow

**Client Flow**: `ServerProxy` → `Transport` → HTTP request → XML marshalling → Server processing → XML unmarshalling → Python objects

**Server Flow**: HTTP request → `RequestHandler` → `Dispatcher` → Method resolution → Function execution → XML response → Client

**Method Registration**: Functions/instances registered with dispatcher → Method name resolution → Introspection support → Documentation generation

### Important Patterns and Conventions

**Type Dispatch System**: Both marshalling and unmarshalling use dispatch dictionaries mapping Python types to serialization handlers

**Connection Management**: Transport classes implement HTTP/1.1 keep-alive with connection pooling for performance

**Security Model**: Private method blocking (underscore prefix), path validation, and controlled traceback exposure

**Extensibility**: Mix-in classes enable combining functionality (dispatcher + server, documentation + handling)

**Protocol Compliance**: Full XML-RPC specification support including multicall, introspection, and fault handling

### Integration Context

Within LLDB's ecosystem, this package enables remote debugging scenarios where the debugger client communicates with remote debugging servers using standardized XML-RPC protocols. The comprehensive implementation supports both simple request/response patterns and advanced features like method batching and auto-discovery.