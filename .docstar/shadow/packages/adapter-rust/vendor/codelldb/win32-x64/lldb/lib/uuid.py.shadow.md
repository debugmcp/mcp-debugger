# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/uuid.py
@source-hash: fe357bff7241e9fd
@generated: 2026-02-09T18:14:33Z

## Python UUID Module Implementation

Core RFC 4122 UUID implementation providing immutable UUID objects and generation functions for versions 1, 3, 4, and 5.

### Key Classes

**SafeUUID (L78-82)**: Enum indicating UUID generation safety for multiprocessing applications (safe=0, unsafe=-1, unknown=None).

**UUID (L85-358)**: Immutable RFC 4122 UUID implementation with comprehensive parsing and representation capabilities.
- Constructor (L139-223): Accepts hex strings, bytes, bytes_le, fields tuple, or 128-bit int
- String representation (L280-283): Standard hyphenated format (8-4-4-4-12)
- Field extraction properties (L295-332): time_low, time_mid, time_hi_version, clock_seq_hi_variant, clock_seq_low, node
- Format properties (L285-340): bytes, bytes_le, fields, hex, urn
- Metadata properties (L342-358): variant detection and version extraction
- Comparison operators (L240-266): Full ordering support based on int value
- Immutability enforcement (L277-278): Prevents attribute modification

### UUID Generation Functions

**uuid1() (L674-710)**: Time-based UUID using MAC address and timestamp
- Uses system _generate_time_safe if available for thread safety
- Falls back to manual timestamp calculation with collision avoidance
- Requires node ID (MAC address) via getnode()

**uuid3() (L712-721)**: Name-based UUID using MD5 hash of namespace + name

**uuid4() (L723-725)**: Random UUID using os.urandom(16)

**uuid5() (L727-733)**: Name-based UUID using SHA-1 hash of namespace + name

### MAC Address Discovery System

Platform-specific MAC address retrieval for uuid1() generation:

**Command execution framework**:
- _get_command_stdout() (L360-388): Safe subprocess execution with locale normalization
- _find_mac_near_keyword() (L410-442): Searches command output for MAC addresses near keywords
- _find_mac_under_heading() (L473-506): Extracts MAC from columnar output
- _parse_mac() (L445-470): Parses MAC address strings with platform-specific delimiters

**Platform-specific getters**:
- _ifconfig_getnode() (L511-519): Unix ifconfig parsing
- _ip_getnode() (L521-527): Linux iproute2 parsing  
- _arp_getnode() (L529-555): ARP table parsing
- _netstat_getnode() (L562-565): AIX/Tru64 netstat parsing
- _lanscan_getnode() (L557-560): HP-UX lanscan parsing
- _unix_getnode() (L595-599): Uses _uuid C extension if available
- _windll_getnode() (L601-605): Windows UUID API via _uuid extension
- _random_getnode() (L607-620): RFC 4122 compliant random MAC with multicast bit

**getnode() (L650-669)**: Main MAC address discovery function trying getters in platform-specific order with caching.

### Platform Detection

Lines 56-68: Platform-specific behavior flags (_AIX, _LINUX) and MAC address formatting (_MAC_DELIM, _MAC_OMITS_LEADING_ZEROES).

Lines 629-646: Platform-specific getter ordering in _OS_GETTERS and _GETTERS lists.

### C Extension Integration

Lines 579-588: Optional _uuid C extension import for performance-critical operations (_generate_time_safe, _UuidCreate, _has_uuid_generate_time_safe).

### Command Line Interface

**main() (L736-782)**: Full CLI with argparse supporting all UUID generation types and predefined namespaces.

### Standard Namespaces

Lines 787-790: RFC 4122 predefined namespace UUIDs (DNS, URL, OID, X500).

### Key Invariants

- UUIDs are immutable after construction
- Universal MAC addresses preferred over locally administered ones
- Thread-safe timestamp generation with collision avoidance
- Graceful fallback from system functions to portable implementations