# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xmlrpc/server.py
@source-hash: 6781c25a6224b8ba
@generated: 2026-02-09T18:11:32Z

## XML-RPC Server Implementation

This module provides comprehensive XML-RPC server functionality with support for function registration, instance handling, introspection, CGI deployment, and auto-generated HTML documentation.

### Core Classes

**SimpleXMLRPCDispatcher (L156-421)**: Mix-in class that handles XML-RPC method dispatching and registration. Key responsibilities:
- Method registration via `register_function()` (L209-223) and `register_instance()` (L173-207) 
- XML-RPC request marshalling/unmarshalling via `_marshaled_dispatch()` (L244-277)
- Method resolution through `_dispatch()` (L372-421) with fallback hierarchy: registered functions → instance._dispatch → instance methods
- Built-in introspection support: `system.listMethods`, `system.methodHelp`, `system.methodSignature` (L279-308)
- Multicall support via `system.multicall()` (L341-370)

**SimpleXMLRPCRequestHandler (L423-568)**: HTTP request handler for XML-RPC over HTTP:
- Handles POST requests with XML-RPC payload processing (L466-535)
- Supports gzip compression/decompression (L537-552)
- Path validation against `rpc_paths` whitelist (L459-464)
- Request chunking for large payloads (L483-493)

**SimpleXMLRPCServer (L569-595)**: Main server class combining TCPServer with XML-RPC dispatcher:
- Inherits from `socketserver.TCPServer` and `SimpleXMLRPCDispatcher`
- Configurable logging via `logRequests` parameter
- Debug traceback headers controlled by `_send_traceback_header` (L586)

**MultiPathXMLRPCServer (L597-634)**: Supports multiple XML-RPC dispatchers on different URL paths:
- Path-based dispatcher routing via `add_dispatcher()` (L615-617)
- Overrides `_marshaled_dispatch()` to delegate based on request path (L622-634)

### CGI Support

**CGIXMLRPCRequestHandler (L636-699)**: Handles XML-RPC requests in CGI environments:
- Processes POST data from environment variables (L692-698)
- Outputs proper CGI headers via stdout (L647-652)

### Documentation Generation

**ServerHTMLDoc (L705-815)**: Extends pydoc.HTMLDoc for XML-RPC server documentation:
- Custom markup for hyperlinks, RFCs, PEPs (L708-745)
- Method documentation formatting via `docroutine()` (L747-774)
- Complete server documentation via `docserver()` (L776-799)

**XMLRPCDocGenerator (L816-895)**: Mix-in for generating HTML documentation:
- Introspects registered methods and instances
- Supports custom `_get_method_argstring()` and `_methodHelp()` hooks
- Generates complete HTML documentation via `generate_html_documentation()` (L846-895)

**DocXMLRPCRequestHandler (L897-935)**: Combines XML-RPC handling with GET-based documentation:
- Serves CSS files for documentation styling (L907-911)
- Handles GET requests for HTML documentation (L913-935)

**DocXMLRPCServer (L937-951)** and **DocCGIXMLRPCRequestHandler (L953-976)**: Combined server and CGI handler classes with documentation support.

### Utility Functions

- `resolve_dotted_attribute()` (L124-146): Safely resolves dotted attribute names with security checks
- `list_public_methods()` (L148-154): Extracts callable public methods from objects

### Security Considerations

- Private method protection: methods starting with '_' are blocked
- Dotted name security warning for `allow_dotted_names` option (L197-203)
- Path validation to prevent unauthorized access
- Optional traceback exposure control for debugging

### Dependencies

- `xmlrpc.client` for XML-RPC protocol handling
- `http.server`, `socketserver` for HTTP server infrastructure  
- `pydoc` for documentation generation
- `fcntl` (optional) for Unix-specific functionality