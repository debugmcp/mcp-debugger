# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/uuid.py
@source-hash: fe357bff7241e9fd
@generated: 2026-02-09T18:10:21Z

## Purpose
Python UUID module providing RFC 4122-compliant universally unique identifier generation and manipulation. Core implementation for generating version 1 (time-based), 3 (MD5 hash), 4 (random), and 5 (SHA-1 hash) UUIDs with platform-specific MAC address detection.

## Key Classes

### SafeUUID Enum (L78-83)
Indicates UUID generation safety for multiprocessing:
- `safe`: Generated via thread-safe system function
- `unsafe`: Generated via non-thread-safe method  
- `unknown`: Safety status undetermined

### UUID Class (L85-358)
Immutable UUID representation with multiple construction methods:
- **Constructor** (L139-223): Accepts hex string, bytes, bytes_le, fields tuple, or 128-bit int
- **Properties**: `bytes` (L285-287), `fields` (L296-298), `time` (L321-323), `variant` (L343-351), `version` (L354-357)
- **Comparison operators** (L240-266): Full ordering support based on integer value
- **String representation** (L280-283): Standard hyphenated format

## Core Functions

### UUID Generation Functions
- **uuid1()** (L674-710): Time-based UUID using MAC address and timestamp
- **uuid3()** (L712-721): Name-based UUID using MD5 hash
- **uuid4()** (L723-725): Random UUID using os.urandom()
- **uuid5()** (L727-733): Name-based UUID using SHA-1 hash

### MAC Address Detection (L410-670)
Platform-specific functions for hardware address discovery:
- **getnode()** (L650-669): Main entry point, tries multiple methods
- **Platform-specific getters**: `_ifconfig_getnode()` (L511-519), `_ip_getnode()` (L521-527), `_arp_getnode()` (L529-555)
- **Fallback**: `_random_getnode()` (L607-620) generates random MAC with multicast bit set

## Platform Detection & Configuration

### Platform Variables (L56-68)
- `_AIX`, `_LINUX`: Boolean flags for platform-specific behavior
- `_MAC_DELIM`, `_MAC_OMITS_LEADING_ZEROES`: MAC address parsing configuration

### System Integration (L578-647)
- Optional `_uuid` C extension import for performance
- Platform-specific getter function lists (`_GETTERS`, `_OS_GETTERS`)
- System function loading via `_generate_time_safe`, `_UuidCreate`

## Utility Functions

### Command Execution (L360-388)
`_get_command_stdout()`: Executes system commands safely for MAC address discovery

### MAC Address Parsing (L445-506)
- `_parse_mac()` (L445-470): Parses colon/dot-delimited MAC addresses
- `_find_mac_near_keyword()` (L410-442): Searches command output for MAC addresses
- `_is_universal()` (L406-407): Distinguishes universal vs locally-administered MACs

## Constants & Namespaces (L785-790)
Standard namespace UUIDs for uuid3/uuid5: `NAMESPACE_DNS`, `NAMESPACE_URL`, `NAMESPACE_OID`, `NAMESPACE_X500`

## CLI Interface
`main()` (L736-782): Command-line interface supporting all UUID generation functions with namespace handling

## Dependencies
- Standard library: `os`, `sys`, `platform`, `enum`, `hashlib`, `subprocess`
- Optional C extension: `_uuid` for performance-critical operations
- Cross-platform compatibility with Windows, macOS, Linux, AIX support