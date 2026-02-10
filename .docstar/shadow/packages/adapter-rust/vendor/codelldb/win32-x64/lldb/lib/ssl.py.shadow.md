# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ssl.py
@source-hash: 039a0e3f1782e148
@generated: 2026-02-09T18:13:20Z

This file is Python's SSL module wrapper providing high-level SSL/TLS functionality over the low-level `_ssl` C extension module. It offers object-oriented interfaces for secure socket communication with enhanced Python integration.

## Core Components

**Enumerations and Constants (L123-168)**
- `_SSLMethod` (L123-126): SSL protocol method enumeration from `_ssl` constants
- `Options` (L128-131): SSL context option flags 
- `AlertDescription` (L133-136): TLS alert message descriptions
- `SSLErrorNumber` (L138-141): SSL error code enumeration
- `VerifyFlags` (L143-146) & `VerifyMode` (L148-151): Certificate verification settings
- `TLSVersion` (L159-168): Supported TLS version enumeration

**Certificate/Hostname Validation (L280-374)**
- `_dnsname_match(dn, hostname)` (L280-327): RFC 6125 DNS name matching with wildcard support
- `_inet_paton(ipname)` (L329-362): IP address parsing for IPv4/IPv6
- `_ipaddress_match(cert_ipaddress, host_ip)` (L364-374): Exact IP address matching

**ASN.1 and Purpose Objects (L394-420)**
- `_ASN1Object` (L394-413): ASN.1 object identifier wrapper with factory methods
- `Purpose` (L415-420): X.509 Extended Key Usage purposes (SERVER_AUTH, CLIENT_AUTH)

**SSLContext Class (L422-680)**
Primary SSL configuration container extending `_SSLContext`:
- `__new__(protocol=None)` (L430-439): Context creation with deprecation warning
- `wrap_socket()` (L449-463): Creates SSLSocket instances
- `wrap_bio()` (L465-473): Creates SSLObject instances for memory BIO
- `set_npn_protocols()` (L475-489): NPN protocol configuration (deprecated)
- `set_alpn_protocols()` (L504-513): ALPN protocol configuration
- `load_default_certs()` (L528-534): Loads system certificate stores
- Property wrappers for minimum/maximum TLS versions (L536-553), options (L555-561), verify settings (L662-679)
- `_msg_callback` (L580-655): TLS message debugging hook with enum conversion

**SSLObject Class (L782-935)**
Low-level SSL object for memory BIO operations:
- `_create()` (L803-813): Factory method for BIO-based SSL objects
- Core SSL operations: `read()` (L849-859), `write()` (L861-867), `do_handshake()` (L914-916)
- Certificate/session management: `getpeercert()` (L869-876), session properties (L824-836)
- Protocol negotiation: `selected_alpn_protocol()` (L888-892), `cipher()` (L894-897)

**SSLSocket Class (L943-1388)**
High-level SSL socket extending `socket.socket`:
- `_create()` (L955-1048): Complex socket creation with connection state management
- Connection handling: `connect()` (L1349-1352), `accept()` (L1359-1369)
- Data transmission: `send()` (L1172-1181), `recv()` (L1225-1234), `sendall()` (L1199-1213)
- SSL-specific restrictions on UDP methods: `sendto()`, `recvfrom()` raise exceptions

**Utility Functions**
- `create_default_context()` (L682-718): Factory for secure default SSL contexts
- `_create_unverified_context()` (L720-772): Less restrictive context for stdlib use
- `cert_time_to_seconds()` (L1397-1425): Certificate timestamp parsing
- `DER_cert_to_PEM_cert()` & `PEM_cert_to_DER_cert()` (L1430-1451): Certificate format conversion
- `get_server_certificate()` (L1453-1473): Remote certificate retrieval
- `get_default_verify_paths()` (L380-391): System CA path discovery

## Key Dependencies
- `_ssl` C extension module for OpenSSL bindings
- `socket` module for network primitives  
- `enum` for type-safe constants
- Platform-specific certificate store access on Windows

## Architectural Patterns
- Factory pattern for object creation (`_create` methods)
- Property-based enum conversion for type safety
- Decorator pattern (`_sslcopydoc`) for documentation inheritance
- Context manager support throughout socket operations