# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/wsgiref/simple_server.py
@source-hash: d435cad48b5f63c0
@generated: 2026-02-09T18:06:10Z

**Purpose**: A lightweight WSGI server implementation for development and testing purposes. Provides BaseHTTPServer-based WSGI protocol support (PEP 3333) for running simple web applications locally.

**Key Components**:

- **ServerHandler (L28-39)**: Extends `wsgiref.handlers.SimpleHandler` with server software identification and request logging. Overrides `close()` to log request status and bytes sent.

- **WSGIServer (L42-68)**: Main WSGI server class extending HTTPServer. Stores WSGI applications and sets up CGI environment variables. Key methods:
  - `server_bind()` (L48-51): Binds server and initializes environment
  - `setup_environ()` (L53-62): Creates base CGI environment with SERVER_NAME, GATEWAY_INTERFACE, etc.
  - `get_app()`/`set_app()` (L63-67): Application getter/setter

- **WSGIRequestHandler (L71-135)**: Handles individual HTTP requests, extending BaseHTTPRequestHandler. Core functionality:
  - `get_environ()` (L75-110): Builds complete WSGI environ dict from HTTP headers, path, query string
  - `handle()` (L115-134): Main request processing with 64KB line limit protection, creates ServerHandler instance

- **demo_app() (L138-147)**: Simple WSGI application that echoes "Hello world!" and dumps environment variables as plain text response.

- **make_server() (L150-156)**: Factory function to create configured WSGI server instances with specified host, port, and application.

**Dependencies**: 
- `http.server` for BaseHTTPRequestHandler/HTTPServer
- `wsgiref.handlers.SimpleHandler` for WSGI protocol handling
- `urllib.parse` for path decoding

**Architecture**: Classic WSGI server pattern with request handler creating ServerHandler instances per request. Environment building follows CGI specification with HTTP header mapping.

**Critical Constraints**:
- 65536 byte limit on request lines (L118-124)
- Single-threaded operation (multithread=False, L131)
- Development-only - not security reviewed for production use
- Uses iso-8859-1 encoding for PATH_INFO decoding (L85)

**Main Entry Point**: If run directly, starts server on localhost:8000 with demo app and opens browser (L159-165).