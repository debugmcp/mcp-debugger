# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/xmlrpc/server.py
@source-hash: 6781c25a6224b8ba
@generated: 2026-02-09T18:06:20Z

## Python XML-RPC Server Implementation

Complete implementation of XML-RPC server infrastructure providing HTTP-based remote procedure call functionality with automatic request marshalling/unmarshalling and optional HTML documentation generation.

### Core Components

**SimpleXMLRPCDispatcher** (L156-422): Core mix-in class responsible for XML-RPC method registration and dispatch logic. Maintains function registry (`self.funcs`), instance registration (`self.instance`), and encoding parameters. Key methods:
- `register_function()` (L209-223): Registers individual functions with optional name mapping
- `register_instance()` (L173-207): Registers object instance with optional dotted name support (security warning)
- `_dispatch()` (L372-421): Routes incoming method calls to registered functions or instance methods
- `_marshaled_dispatch()` (L244-277): Handles XML serialization/deserialization with fault handling
- Introspection methods: `system_listMethods()`, `system_methodHelp()`, `system_multicall()`

**SimpleXMLRPCRequestHandler** (L423-568): HTTP request handler extending BaseHTTPRequestHandler for XML-RPC protocol. Features:
- `do_POST()` (L466-535): Processes XML-RPC requests with chunked reading and gzip support
- `accept_encodings()` (L448-457): Parses Accept-Encoding header with quality values
- `decode_request_content()` (L537-552): Handles gzip-encoded request content
- Path validation via `rpc_paths` class attribute (L432)

**SimpleXMLRPCServer** (L569-595): Complete XML-RPC server combining TCPServer and SimpleXMLRPCDispatcher. Configurable logging, encoding, and debug traceback options.

**MultiPathXMLRPCServer** (L597-634): Extends SimpleXMLRPCServer to support multiple dispatcher instances mapped to different URL paths, enabling virtual XML-RPC servers on single port.

### Documentation System

**ServerHTMLDoc** (L705-815): Specialized HTML documentation generator extending pydoc.HTMLDoc with XML-RPC specific markup for hyperlinks, method signatures, and server documentation formatting.

**XMLRPCDocGenerator** (L816-896): Mix-in class providing HTML documentation generation capabilities:
- `generate_html_documentation()` (L846-895): Creates comprehensive method documentation using introspection
- Server metadata management methods for title, name, and description

**DocXMLRPCRequestHandler** (L897-936): Enhanced request handler supporting both XML-RPC (POST) and documentation (GET) requests with CSS serving capability.

**DocXMLRPCServer** (L937-952): Full-featured server combining XML-RPC functionality with integrated HTML documentation.

### CGI Support

**CGIXMLRPCRequestHandler** (L636-700): Standalone XML-RPC handler for CGI environments, handling both POST XML-RPC requests and GET documentation requests without HTTP server infrastructure.

### Utility Functions

**resolve_dotted_attribute()** (L124-146): Securely resolves dotted attribute names while preventing access to private attributes (starting with '_').

**list_public_methods()** (L148-154): Extracts callable public methods from objects for introspection.

### Key Dependencies

- `xmlrpc.client` for XML marshalling/unmarshalling
- `http.server` and `socketserver` for HTTP infrastructure  
- `pydoc` for documentation generation
- `gzip` encoding support for compression

### Security Considerations

- Private method protection (underscore prefix blocking)
- Optional dotted name access with explicit security warnings (L197-203)
- Path validation for request routing
- Debug traceback header disabled by default (L586)

### Usage Patterns

File includes comprehensive examples (L19-102) demonstrating function registration, instance registration, custom dispatch, subclassing, and CGI deployment patterns.