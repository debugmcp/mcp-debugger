# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/uuid.py
@source-hash: fe357bff7241e9fd
@generated: 2026-02-09T18:09:31Z

## UUID Module - RFC 4122 Implementation

Core module for generating and manipulating universally unique identifiers according to RFC 4122. Provides immutable UUID objects and generators for versions 1, 3, 4, and 5 UUIDs.

### Key Classes

**SafeUUID (L78-82)** - Enum indicating UUID generation safety for multiprocessing:
- `safe = 0` - Generated safely
- `unsafe = -1` - Not generated safely  
- `unknown = None` - Safety unknown

**UUID (L85-358)** - Immutable UUID class with comprehensive format support:
- Constructor (L139-223) accepts hex string, bytes, bytes_le, fields tuple, or 128-bit int
- Multiple format properties: `bytes` (L285-287), `hex` (L334-336), `urn` (L338-340)  
- Field extraction: `time_low` (L300-302), `node` (L330-332), etc.
- Comparison operators (L240-266) enable sorting for B-tree usage
- Immutability enforced via `__setattr__` override (L277-278)

### UUID Generation Functions

**uuid1(node, clock_seq) (L674-710)** - Time-based UUID from host ID and timestamp
- Uses system `_generate_time_safe` when available
- Falls back to manual timestamp calculation with Unix epoch conversion
- Handles timestamp collision prevention

**uuid3(namespace, name) (L712-721)** - MD5 hash-based UUID from namespace + name

**uuid4() (L723-725)** - Random UUID using `os.urandom(16)`

**uuid5(namespace, name) (L727-733)** - SHA-1 hash-based UUID from namespace + name

### Hardware Address Discovery

**getnode() (L650-669)** - Platform-specific MAC address retrieval with fallback chain:
- Caches result in global `_node` variable
- Unix: Uses `_unix_getnode` (L595-599) via extension module
- Windows: Uses `_windll_getnode` (L601-605) via extension module  
- Fallback methods: `_ifconfig_getnode` (L511-519), `_ip_getnode` (L521-527), `_arp_getnode` (L529-555)
- Final fallback: `_random_getnode` (L607-620) with multicast bit set

### Platform Detection & Configuration

Platform-specific behavior controlled by globals (L56-68):
- `_AIX`, `_LINUX` flags determine MAC address parsing format
- `_MAC_DELIM` and `_MAC_OMITS_LEADING_ZEROES` adapt to platform conventions
- OS-specific getter prioritization in `_OS_GETTERS` (L629-646)

### Utility Functions

**Command execution helpers:**
- `_get_command_stdout(command, *args) (L360-388)` - Execute system commands safely
- `_find_mac_near_keyword()` (L410-442) - Parse MAC from command output by keyword proximity
- `_find_mac_under_heading()` (L473-506) - Extract MAC from columnar command output

**MAC address validation:**
- `_is_universal(mac) (L406-407)` - Check if MAC is universally vs locally administered
- `_parse_mac(word) (L445-470)` - Parse and validate MAC address format

### Standard Namespaces (L787-790)

Predefined namespace UUIDs for use with uuid3/uuid5:
- `NAMESPACE_DNS`, `NAMESPACE_URL`, `NAMESPACE_OID`, `NAMESPACE_X500`

### CLI Interface

**main() (L736-782)** - Command-line UUID generation tool supporting all UUID types with namespace handling for uuid3/uuid5.

### Dependencies
- `os`, `sys` - System interaction
- `enum` - SafeUUID enumeration  
- `platform` - OS detection
- `hashlib` - MD5/SHA-1 for uuid3/uuid5
- `_uuid` (optional) - C extension for performance