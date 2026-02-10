# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/ssl.py
@source-hash: 039a0e3f1782e148
@generated: 2026-02-09T18:08:15Z

## Purpose
Python SSL wrapper module providing high-level SSL/TLS functionality. Acts as a Pythonic interface to the low-level `_ssl` C extension, offering SSL socket classes, context management, and certificate utilities for secure network communications.

## Key Classes and Components

### SSLContext (L422-680)
Main SSL configuration container extending `_SSLContext`. Manages certificates, protocols, verification modes, and cipher settings.
- **Constructor**: Wraps protocol selection with deprecation handling (L430-439)
- **wrap_socket()** (L449-463): Creates SSLSocket instances from regular sockets
- **wrap_bio()** (L465-473): Creates SSLObject instances for memory buffer I/O
- **set_alpn_protocols()** (L504-513): Configures ALPN protocol negotiation
- **load_default_certs()** (L528-534): Loads system certificate stores, Windows-specific handling

### SSLSocket (L943-1388)
Socket subclass providing SSL-encrypted communication over network connections.
- **_create()** classmethod (L955-1048): Factory method with complex connection state validation
- **Network I/O methods**: send/recv/sendall (L1172-1214) with SSL-aware implementations
- **SSL-specific methods**: do_handshake() (L1313-1321), getpeercert() (L1125-1128)
- **Connection management**: connect() (L1349-1352), accept() (L1359-1369)

### SSLObject (L782-935)
Memory buffer-based SSL interface for asynchronous frameworks. No direct network I/O.
- **_create()** classmethod (L803-813): Factory using BIO objects for I/O
- **Core SSL operations**: read/write (L849-867), handshake (L914-916)
- **Certificate/protocol info**: getpeercert(), cipher(), version()

## Enumerations and Constants

### Protocol/Version Enums (L159-225)
- **TLSVersion** (L160-167): Supported TLS protocol versions
- **_TLSContentType** (L171-182): TLS record layer content types
- **_TLSAlertType** (L186-224): TLS alert message types
- **_TLSMessageType** (L228-254): Handshake protocol message types

### Auto-generated Enums (L123-151)
Dynamic enum creation from `_ssl` constants using `_convert_()`:
- **_SSLMethod**: Protocol constants (PROTOCOL_*)
- **Options**: SSL option flags (OP_*)
- **VerifyMode/VerifyFlags**: Certificate verification settings

## Utility Functions

### Certificate Processing
- **cert_time_to_seconds()** (L1397-1425): Converts ASN.1 time strings to Unix timestamps
- **DER_cert_to_PEM_cert()** (L1430-1438): Binary DER to PEM text conversion
- **PEM_cert_to_DER_cert()** (L1440-1451): PEM text to binary DER conversion
- **get_server_certificate()** (L1453-1473): Retrieves and converts server certificates

### Context Creation
- **create_default_context()** (L682-718): Secure-by-default SSL context factory
- **_create_unverified_context()** (L720-772): Backward-compatible context for stdlib modules

### Hostname/IP Validation
- **_dnsname_match()** (L280-326): RFC 6125 DNS name matching with wildcard support
- **_inet_paton()** (L329-361): IP address parsing for both IPv4 and IPv6
- **_ipaddress_match()** (L364-373): Exact IP address matching for certificates

## Dependencies and Integration
- **Core imports**: `_ssl` C extension, `socket` module, `enum` framework
- **Platform-specific**: Windows certificate store integration (L257-258, L515-526)
- **OpenSSL integration**: Version info, random number generation, ASN.1 object handling

## Architectural Patterns
- **Factory pattern**: SSLSocket/SSLObject creation through class methods
- **Wrapper pattern**: High-level Python interfaces around low-level SSL objects  
- **Context manager support**: Automatic resource cleanup in certificate retrieval
- **Enum auto-conversion**: Dynamic creation of enums from C extension constants