# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/ssl.py
@source-hash: 039a0e3f1782e148
@generated: 2026-02-09T18:10:12Z

## SSL Module - Python SSL/TLS Wrapper

Primary Python wrapper module for OpenSSL's _ssl module, providing high-level SSL/TLS functionality including socket wrapping, context management, and certificate handling.

### Core Classes

**SSLContext (L422-680)**: Main SSL configuration container
- Wraps `_ssl._SSLContext` with Python-friendly interface
- Properties: minimum_version/maximum_version (L536-553), options (L555-561), verify_mode (L669-679)
- Methods: wrap_socket() (L449-463), wrap_bio() (L465-473), load_default_certs() (L528-534)
- Protocol validation: set_alpn_protocols() (L504-513), set_npn_protocols() (L475-489)
- Windows certificate store loading: _load_windows_store_certs() (L515-526)
- TLS message debugging: _msg_callback property (L580-655)

**SSLSocket (L943-1388)**: SSL-wrapped socket implementation 
- Inherits from socket.socket, wraps underlying socket with SSL
- Factory method: _create() (L955-1048) handles connection validation and SSL object creation
- Network I/O: read()/write() (L1094-1122), send()/recv() families (L1172-1253)
- SSL operations: do_handshake() (L1312-1321), unwrap() (L1292-1299)
- Connection management: connect()/accept() (L1349-1369)
- Validation: _checkClosed() (L1082), _check_connected() (L1086-1092)

**SSLObject (L782-935)**: Low-level SSL object for BIO-based I/O
- Factory method: _create() (L803-813)
- SSL operations: read()/write() (L849-867), do_handshake() (L914-916)
- Certificate access: getpeercert() (L869-876), cipher() (L894-897)
- Protocol negotiation: selected_alpn_protocol() (L888-892)

### Enumerations and Constants

**TLS Protocol Enums (L159-255)**:
- TLSVersion (L160-167): Protocol version constants
- _TLSContentType (L171-182): TLS record layer content types
- _TLSAlertType (L186-224): TLS alert message types  
- _TLSMessageType (L228-254): TLS handshake message types

**Converted Enums (L123-151)**: Auto-generated from _ssl constants
- _SSLMethod, Options, AlertDescription, SSLErrorNumber, VerifyFlags, VerifyMode

### Utility Functions

**Certificate Processing**:
- cert_time_to_seconds() (L1397-1425): Parse certificate timestamp strings
- DER_cert_to_PEM_cert() / PEM_cert_to_DER_cert() (L1430-1451): Format conversion
- get_server_certificate() (L1453-1473): Retrieve remote server certificate

**Hostname/IP Validation**:
- _dnsname_match() (L280-326): RFC 6125 DNS name matching with wildcard support
- _inet_paton() (L329-361): IP address parsing for IPv4/IPv6
- _ipaddress_match() (L364-373): Exact IP address matching

**Context Creation**:
- create_default_context() (L682-718): Secure SSL context with modern defaults
- _create_unverified_context() (L720-772): Backward-compatible less-secure context
- get_default_verify_paths() (L380-391): System CA certificate locations

### Key Dependencies

- _ssl module: Core OpenSSL bindings and low-level SSL objects
- socket module: Base socket functionality for SSLSocket
- enum module: Type-safe constant definitions  
- collections.namedtuple: DefaultVerifyPaths, _ASN1Object structures
- Platform-specific: Windows certificate enumeration (L257-258)

### Notable Patterns

- Extensive use of property decorators for type conversion and validation
- Factory pattern with private _create() methods to prevent direct instantiation
- Decorator pattern: _sslcopydoc() (L937-940) for documentation inheritance
- Error handling with context managers and proper resource cleanup
- SSL object lifecycle management through _connected and _sslobj state tracking