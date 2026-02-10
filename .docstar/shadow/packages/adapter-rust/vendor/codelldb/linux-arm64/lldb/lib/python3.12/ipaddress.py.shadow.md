# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/ipaddress.py
@source-hash: 4a1e3e176e2d88ec
@generated: 2026-02-09T18:08:48Z

## IPv4/IPv6 Manipulation Library

**Primary Purpose:** Fast, lightweight Python library for creating, manipulating, and analyzing IPv4 and IPv6 addresses and networks. Part of the standard Python library, providing comprehensive IP address handling capabilities.

### Key Factory Functions
- `ip_address(address)` (L28): Auto-detects and returns IPv4Address or IPv6Address objects
- `ip_network(address, strict=True)` (L57): Auto-detects and returns IPv4Network or IPv6Network objects  
- `ip_interface(address)` (L86): Auto-detects and returns IPv4Interface or IPv6Interface objects

### Utility Functions
- `v4_int_to_packed(address)` (L120): Converts IPv4 integer to 4-byte big-endian representation
- `v6_int_to_packed(address)` (L140): Converts IPv6 integer to 16-byte big-endian representation
- `summarize_address_range(first, last)` (L200): Summarizes IP address ranges into CIDR blocks
- `collapse_addresses(addresses)` (L304): Collapses overlapping/adjacent IP networks into minimal set

### Exception Hierarchy
- `AddressValueError(ValueError)` (L20): IP address parsing/validation errors
- `NetmaskValueError(ValueError)` (L24): Netmask/prefix length validation errors

### Base Classes
- `_IPAddressBase` (L383): Abstract base providing common IP functionality (exploded/compressed properties, reverse DNS)
- `_BaseAddress` (L564): Base for single IP addresses with arithmetic operations and comparison
- `_BaseNetwork` (L672): Base for IP networks with iteration, subnetting, and network operations

### IPv4 Implementation
- `IPv4Address(_BaseV4, _BaseAddress)` (L1280): Single IPv4 address representation
  - Supports string, integer, and bytes construction
  - Properties: `packed`, `is_private`, `is_global`, `is_multicast`, etc.
- `IPv4Interface(IPv4Address)` (L1420): IPv4 address with associated network/prefix
- `IPv4Network(_BaseV4, _BaseNetwork)` (L1487): IPv4 network block representation
  - Constructor validates host bits based on `strict` parameter
  - Provides host iteration, subnetting operations

### IPv6 Implementation  
- `IPv6Address(_BaseV6, _BaseAddress)` (L1914): Single IPv6 address representation
  - Supports scope IDs (RFC 4007)
  - Properties: `ipv4_mapped`, `teredo`, `sixtofour` for embedded IPv4 detection
- `IPv6Interface(IPv6Address)` (L2165): IPv6 address with associated network/prefix
- `IPv6Network(_BaseV6, _BaseNetwork)` (L2240): IPv6 network block representation

### Constants and Network Definitions
- `_IPv4Constants` (L1569): Defines standard IPv4 network ranges (private, reserved, multicast, etc.)
- `_IPv6Constants` (L2332): Defines standard IPv6 network ranges and special addresses

### Key Architectural Patterns
- Factory pattern for auto-detection of IP version
- Caching of netmask objects for performance (`_netmask_cache`)
- Consistent interface across IPv4/IPv6 with version-specific implementations
- Rich comparison and arithmetic operations on addresses
- Integration with Python's data model (__hash__, __eq__, __str__, etc.)

### Critical Invariants
- All addresses are stored internally as integers
- Network addresses must not have host bits set (unless `strict=False`)
- Interface objects combine address and network information
- Private/global classification follows IANA registry specifications