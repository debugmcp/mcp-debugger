# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/ipaddress.py
@source-hash: 4a1e3e176e2d88ec
@generated: 2026-02-09T18:07:14Z

## Primary Purpose

Python's standard `ipaddress` module providing comprehensive IPv4/IPv6 address and network manipulation capabilities. This is a vendor-distributed copy within LLDB's Python environment for the CodeLLDB Rust debugger adapter.

## Key Classes and Functions

### Factory Functions
- `ip_address()` (L28-54): Auto-detects and creates IPv4Address or IPv6Address objects from string/int input
- `ip_network()` (L57-83): Auto-detects and creates IPv4Network or IPv6Network objects with optional strict validation
- `ip_interface()` (L86-117): Auto-detects and creates IPv4Interface or IPv6Interface objects (address + network)

### Utility Functions
- `v4_int_to_packed()` (L120-137): Converts IPv4 integer to 4-byte big-endian representation
- `v6_int_to_packed()` (L140-153): Converts IPv6 integer to 16-byte big-endian representation
- `summarize_address_range()` (L200-252): Summarizes IP address ranges into minimal network blocks
- `collapse_addresses()` (L304-355): Collapses overlapping/adjacent networks into larger blocks
- `get_mixed_type_key()` (L358-380): Provides sorting key for mixed address/network collections

### Base Classes
- `_IPAddressBase` (L383-559): Core functionality shared by all IP objects, provides exploded/compressed properties, reverse DNS pointers
- `_BaseAddress` (L564-668): Generic single IP address functionality with arithmetic operations, comparison, formatting
- `_BaseNetwork` (L672-1129): Generic network functionality including iteration, subnetting, supernetting, containment testing

### IPv4 Implementation
- `_BaseV4` (L1139-1278): IPv4-specific parsing, validation, and string conversion logic
- `IPv4Address` (L1280-1418): Concrete IPv4 address with properties for multicast, private, loopback, link-local classification
- `IPv4Interface` (L1420-1485): IPv4 address with associated network (combines address + network semantics)
- `IPv4Network` (L1487-1567): IPv4 network with subnet iteration, address exclusion, and network property testing

### IPv6 Implementation
- `_BaseV6` (L1611-1912): IPv6-specific parsing including hextet compression, scope ID handling
- `IPv6Address` (L1914-2163): Concrete IPv6 address with IPv4-mapped detection, teredo/6to4 embedded address extraction
- `IPv6Interface` (L2165-2238): IPv6 address with associated network
- `IPv6Network` (L2240-2330): IPv6 network with specialized host iteration (excludes subnet-router anycast)

### Constants Classes
- `_IPv4Constants` (L1569-1605): Predefined IPv4 network ranges for private, reserved, multicast, etc.
- `_IPv6Constants` (L2332-2377): Predefined IPv6 network ranges for private, reserved, multicast, etc.

## Key Patterns

### Auto-Detection Pattern
Factory functions use try/except chains to automatically detect IP version, falling back from IPv4 to IPv6.

### Caching Strategy
Netmask objects are cached in `_netmask_cache` dictionaries to avoid redundant calculations.

### Inheritance Hierarchy
Multiple inheritance combines version-specific base classes (_BaseV4/_BaseV6) with functionality base classes (_BaseAddress/_BaseNetwork).

### Property-Based Classification
Extensive use of properties for network classification (is_private, is_multicast, etc.) with LRU caching on expensive computations.

## Dependencies

- `functools`: For `@total_ordering`, `@lru_cache`, `@cached_property` decorators
- Standard library types: `int`, `str`, `bytes` for address representations

## Critical Constraints

- IPv4 addresses must be 32-bit integers (0 to 2^32-1)
- IPv6 addresses must be 128-bit integers (0 to 2^128-1)
- Network strict mode validation ensures network addresses have host bits unset
- Scope IDs are preserved for IPv6 addresses but affect equality/hashing