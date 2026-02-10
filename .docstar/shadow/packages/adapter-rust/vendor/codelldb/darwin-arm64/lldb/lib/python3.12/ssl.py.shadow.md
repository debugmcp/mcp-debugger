# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/ssl.py
@source-hash: 039a0e3f1782e148
@generated: 2026-02-09T18:07:34Z

## Primary Purpose
Python SSL module wrapper providing high-level SSL/TLS functionality built on top of the low-level `_ssl` C extension. Implements secure socket communication with certificate verification, protocol negotiation, and cryptographic operations.

## Core Classes

**SSLContext (L422-680)**: Main configuration class for SSL settings
- Wraps `_SSLContext` from C extension with Python-friendly interface
- Key methods:
  - `wrap_socket()` (L449-463): Creates SSLSocket from regular socket
  - `wrap_bio()` (L465-473): Creates SSLObject for memory-based I/O
  - `set_alpn_protocols()` (L504-513): Configure ALPN protocol negotiation
  - `load_default_certs()` (L528-534): Load system certificate stores
- Properties for TLS version bounds, verification modes, cipher options
- Windows certificate store integration (L515-526)

**SSLSocket (L943-1388)**: Secure socket implementation
- Inherits from `socket.socket`, adds SSL layer
- Factory method `_create()` (L955-1048): Complex initialization with connection detection
- I/O methods: `read()` (L1094-1113), `write()` (L1115-1122), `send()`/`recv()` families
- SSL-specific operations: `do_handshake()` (L1313-1321), `getpeercert()` (L1125-1128)
- Connection management: `connect()` (L1349-1352), `accept()` (L1359-1369)

**SSLObject (L782-935)**: Memory-buffer SSL interface
- For asynchronous frameworks using BIO (memory buffers)
- Same SSL operations as SSLSocket but no network I/O
- Factory method `_create()` (L803-813)

## Key Enums and Constants

**TLSVersion (L160-167)**: Protocol version enumeration
**Purpose (L415-420)**: X.509 Extended Key Usage purposes (SERVER_AUTH, CLIENT_AUTH)  
**_TLSContentType/_TLSAlertType/_TLSMessageType (L171-254)**: TLS protocol message types

## Utility Functions

**Certificate Management:**
- `cert_time_to_seconds()` (L1397-1425): Parse certificate date strings
- `DER_cert_to_PEM_cert()`/`PEM_cert_to_DER_cert()` (L1430-1451): Format conversion
- `get_server_certificate()` (L1453-1473): Retrieve remote server certificate

**Context Creation:**
- `create_default_context()` (L682-718): Secure default SSL context
- `_create_unverified_context()` (L720-772): Permissive context for stdlib use

**Hostname/IP Verification:**
- `_dnsname_match()` (L280-326): RFC 6125 DNS name matching with wildcard support
- `_inet_paton()` (L329-361): IP address parsing and validation
- `_ipaddress_match()` (L364-373): Exact IP address matching

## Dependencies
- C extension `_ssl` for OpenSSL integration
- `socket` module for network primitives  
- `enum` for type-safe constants
- Platform-specific: Windows certificate store access

## Architecture Patterns
- Factory pattern: SSLContext creates SSLSocket/SSLObject instances
- Wrapper pattern: Python classes wrap C extension objects
- Enum conversion: Uses `_convert_` to create enums from C constants (L123-151)
- Decorator pattern: `_sslcopydoc()` (L937-940) copies docstrings between classes

## Critical Invariants
- SSLSocket requires SOCK_STREAM sockets only (L959-960)
- Server-side sockets cannot specify server_hostname (L962-964)
- Handshake required before most SSL operations
- Certificate verification depends on context verify_mode setting