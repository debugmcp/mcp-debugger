# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/ssl.py
@source-hash: 039a0e3f1782e148
@generated: 2026-02-09T18:09:27Z

## Primary Purpose

Python SSL module providing high-level SSL/TLS support by wrapping the low-level `_ssl` C extension. Located in `/packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/ssl.py`, this is the standard Python SSL library implementation.

## Key Components

### Core SSL Context Class
- **SSLContext (L422-680)**: Main SSL configuration container extending `_SSLContext`
  - `wrap_socket()` (L449-463): Creates SSL sockets from regular sockets
  - `wrap_bio()` (L465-473): Creates SSL objects using BIO (memory buffer) interface
  - `load_default_certs()` (L528-534): Loads system certificate stores
  - Version properties for TLS min/max version control (L537-553)
  - Message callback for TLS protocol debugging (L581-655)

### Socket Classes
- **SSLSocket (L943-1387)**: SSL-wrapped socket extending `socket.socket`
  - `_create()` (L955-1048): Factory method with connection validation
  - Network I/O methods: `send()`, `recv()`, `sendall()` with SSL encryption (L1172-1253)
  - SSL-specific methods: `do_handshake()`, `getpeercert()`, `cipher()` (L1313-1387)
  
- **SSLObject (L782-935)**: Memory-buffer based SSL interface for async frameworks
  - `_create()` (L803-813): Factory method using BIO objects
  - Core SSL operations without network I/O: `read()`, `write()`, `do_handshake()` (L849-934)

### Enumerations and Constants
- **TLS Protocol Enums (L159-254)**:
  - `TLSVersion` (L160-167): TLS version constants
  - `_TLSContentType` (L171-182): Record layer content types
  - `_TLSAlertType` (L186-224): Alert message types
  - `_TLSMessageType` (L228-254): Handshake message types

- **Dynamic Enum Creation (L123-151)**: Uses `_convert_()` to create enums from `_ssl` constants
  - `_SSLMethod`, `Options`, `AlertDescription`, `SSLErrorNumber`, `VerifyFlags`, `VerifyMode`

### Certificate Handling
- **Certificate Utilities (L1397-1473)**:
  - `cert_time_to_seconds()` (L1397-1425): Converts certificate time strings to Unix timestamps
  - `DER_cert_to_PEM_cert()` / `PEM_cert_to_DER_cert()` (L1430-1451): Certificate format conversion
  - `get_server_certificate()` (L1453-1473): Retrieves server certificates

### Hostname Validation
- **DNS Name Matching (L280-326)**: RFC 6125 compliant hostname verification
  - `_dnsname_match()`: Handles wildcard matching with strict validation rules
- **IP Address Matching (L329-373)**: Exact IP address verification for certificates
  - `_inet_paton()` (L329-361): IPv4/IPv6 address parsing
  - `_ipaddress_match()` (L364-373): Certificate IP validation

### Context Creation Functions
- **create_default_context() (L682-718)**: Creates secure SSL contexts with default settings
- **_create_unverified_context() (L720-772)**: Creates permissive contexts for stdlib use

## Dependencies
- **Core**: `_ssl` C extension, `socket`, `sys`, `os`
- **Utilities**: `base64`, `errno`, `warnings`, `collections.namedtuple`
- **Enums**: `enum.Enum`, `enum.IntEnum`, `enum.IntFlag`, `enum._simple_enum`

## Architecture Patterns
- **Wrapper Pattern**: Python classes wrap C extension objects (`_SSLContext`, low-level SSL objects)
- **Factory Pattern**: `_create()` class methods for controlled object instantiation
- **Decorator Pattern**: `@_sslcopydoc` copies docstrings from SSLObject to SSLSocket methods
- **Forward Declaration Workaround**: Classes assigned to context attributes after definition (L1391-1392)

## Critical Invariants
- SSL sockets only support STREAM sockets (L959-960)
- Server-side sockets cannot specify `server_hostname` or `session` (L961-967)
- Hostname checking requires `server_hostname` parameter (L968-969)
- Non-blocking sockets cannot use `do_handshake_on_connect=True` (L1038-1040)

## Platform-Specific Features
- Windows certificate store integration (L257-258, L515-526, L531-533)
- LibreSSL compatibility handling (L110-114)
- Feature flags for SSL/TLS version support (L117-120)