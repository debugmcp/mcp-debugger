# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/ipaddress.py
@source-hash: 4a1e3e176e2d88ec
@generated: 2026-02-09T18:07:54Z

## Primary Purpose
IPv4/IPv6 address and network manipulation library providing comprehensive parsing, validation, and utility functions for IP addressing. Core factory functions create appropriate object types automatically, while class hierarchies handle version-specific implementation details.

## Key Factory Functions
- `ip_address()` (L28-54): Auto-detects IPv4/IPv6 from string/int input, returns appropriate address object
- `ip_network()` (L57-83): Auto-detects IPv4/IPv6 networks with optional strict validation
- `ip_interface()` (L86-117): Creates interface objects combining address + network information
- `v4_int_to_packed()` (L120-137): Converts IPv4 integer to 4-byte big-endian representation
- `v6_int_to_packed()` (L140-153): Converts IPv6 integer to 16-byte big-endian representation

## Address Summarization & Collapsing
- `summarize_address_range()` (L200-252): Generates minimal set of networks covering address range
- `collapse_addresses()` (L304-355): Merges overlapping/adjacent networks into larger blocks
- `_collapse_addresses_internal()` (L255-301): Core algorithm for network merging
- `_find_address_range()` (L164-181): Identifies consecutive address sequences

## Base Class Hierarchy
- `_IPAddressBase` (L383-559): Common properties/methods for all IP objects
  - `.exploded`, `.compressed`, `.reverse_pointer` properties
  - Prefix/netmask conversion methods `_ip_int_from_prefix()`, `_prefix_from_ip_int()`
  - Address validation `_check_int_address()`, `_check_packed_address()`
- `_BaseAddress` (L564-669): Single address functionality with arithmetic operations, formatting
- `_BaseNetwork` (L672-1129): Network range operations, iteration, subnet/supernet methods

## IPv4 Implementation
- `_BaseV4` (L1139-1278): IPv4-specific parsing/formatting
  - `_ip_int_from_string()`: Dotted decimal parsing with strict octet validation
  - `_parse_octet()`: Individual octet validation (0-255, no leading zeros)
- `IPv4Address` (L1280-1418): Single IPv4 address with property checks (private, multicast, etc.)
- `IPv4Interface` (L1420-1485): IPv4 address + network mask combination
- `IPv4Network` (L1487-1567): IPv4 network ranges with host iteration
- `_IPv4Constants` (L1569-1608): Predefined IPv4 network ranges for classification

## IPv6 Implementation
- `_BaseV6` (L1611-1912): IPv6-specific parsing with hextet compression/expansion
  - `_ip_int_from_string()`: Complex parsing handling "::" compression and IPv4-mapped addresses
  - `_compress_hextets()`: Implements IPv6 address compression rules
- `IPv6Address` (L1914-2163): Single IPv6 address with scope ID support, embedded IPv4 detection
- `IPv6Interface` (L2165-2238): IPv6 address + network combination
- `IPv6Network` (L2240-2330): IPv6 network ranges
- `_IPv6Constants` (L2332-2380): Predefined IPv6 network ranges

## Key Architectural Patterns
- Factory pattern: Top-level functions auto-detect IP version and delegate to appropriate classes
- Template method: Base classes define algorithms, subclasses provide version-specific implementations
- Caching: Netmask objects cached in `_netmask_cache` for efficiency
- Constants separation: Network ranges defined in separate constant classes, attached via `_constants` attribute

## Critical Invariants
- All integer representations use big-endian byte order
- Strict validation prevents malformed addresses (leading zeros in IPv4, invalid hex in IPv6)
- Networks always store true network address (host bits cleared unless strict=False)
- Address arithmetic maintains type consistency (IPv4Address + int → IPv4Address)