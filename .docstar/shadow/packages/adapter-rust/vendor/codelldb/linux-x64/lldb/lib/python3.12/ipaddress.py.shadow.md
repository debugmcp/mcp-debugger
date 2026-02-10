# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/ipaddress.py
@source-hash: 4a1e3e176e2d88ec
@generated: 2026-02-09T18:09:49Z

## Purpose
Core IPv4/IPv6 address manipulation library providing comprehensive IP address and network handling functionality. This is the Python standard library's `ipaddress` module, offering object-oriented interfaces for creating, validating, and manipulating IP addresses, networks, and interfaces.

## Key Factory Functions
- `ip_address(address)` (L28-54): Auto-detects and returns IPv4Address or IPv6Address objects
- `ip_network(address, strict=True)` (L57-83): Auto-detects and returns IPv4Network or IPv6Network objects
- `ip_interface(address)` (L86-117): Auto-detects and returns IPv4Interface or IPv6Interface objects

## Core Base Classes
- `_IPAddressBase` (L383-559): Abstract base providing common IP functionality including exploded/compressed properties, version handling, and netmask validation
- `_BaseAddress` (L564-669): Base for individual IP addresses with comparison operators, arithmetic, and formatting support
- `_BaseNetwork` (L672-1129): Base for network objects with iteration, subnet/supernet operations, containment checks, and network analysis

## IPv4 Implementation
- `_BaseV4` (L1139-1278): IPv4-specific parsing, validation, and string conversion methods
- `IPv4Address` (L1280-1418): Concrete IPv4 address implementation with property checks (is_private, is_multicast, etc.)
- `IPv4Network` (L1487-1567): IPv4 network implementation with CIDR support and host enumeration
- `IPv4Interface` (L1420-1485): IPv4 address with associated network (combines address + network)

## IPv6 Implementation  
- `_BaseV6` (L1611-1912): IPv6-specific parsing with hextet compression, scope ID support, and embedded address detection
- `IPv6Address` (L1914-2163): Concrete IPv6 address with IPv4-mapped detection, Teredo/6to4 support, and scope ID handling
- `IPv6Network` (L2240-2330): IPv6 network implementation with 128-bit addressing
- `IPv6Interface` (L2165-2238): IPv6 address with associated network

## Utility Functions
- `v4_int_to_packed(address)` (L120-137): Convert IPv4 integer to 4-byte packed format
- `v6_int_to_packed(address)` (L140-153): Convert IPv6 integer to 16-byte packed format  
- `summarize_address_range(first, last)` (L200-252): Generate optimal network blocks for address range
- `collapse_addresses(addresses)` (L304-355): Merge overlapping/adjacent networks
- `get_mixed_type_key(obj)` (L358-380): Sorting key for mixed address/network collections

## Network Analysis Functions
- `_find_address_range(addresses)` (L164-181): Group consecutive addresses into ranges
- `_collapse_addresses_internal(addresses)` (L255-301): Core network collapsing algorithm
- `_count_righthand_zero_bits(number, bits)` (L184-197): Bit counting utility for subnet calculations

## Constants and Configuration
- `_IPv4Constants` (L1569-1608): IPv4 special-use address ranges (private, multicast, reserved networks)
- `_IPv6Constants` (L2332-2380): IPv6 special-use address ranges and reserved networks
- Global constants: `IPV4LENGTH = 32`, `IPV6LENGTH = 128` (L16-17)

## Exception Hierarchy
- `AddressValueError(ValueError)` (L20-21): Invalid IP address format
- `NetmaskValueError(ValueError)` (L24-25): Invalid netmask/prefix specification

## Key Design Patterns
- Factory functions with automatic version detection and graceful fallback
- Extensive use of `@functools.cached_property` for expensive computations
- Total ordering implementation via `@functools.total_ordering` decorator
- Consistent `__slots__` usage for memory efficiency
- Comprehensive property-based classification system (is_private, is_multicast, etc.)
- Netmask caching for performance optimization