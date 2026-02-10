# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/urllib/robotparser.py
@source-hash: 389b811835f9a3ba
@generated: 2026-02-09T18:06:14Z

## robotparser.py - Robots.txt Parser Implementation

**Primary Purpose**: Implements RFC-compliant parsing and querying of robots.txt files to determine web crawling permissions for user agents.

### Core Classes

**RobotFileParser (L22-213)** - Main parser class for robots.txt files
- `__init__(url='')` (L28-35): Initializes parser state including entries list, sitemaps, and URL
- `set_url(url)` (L54-57): Sets target robots.txt URL and extracts host/path components
- `read()` (L59-71): Fetches robots.txt from URL, handles HTTP errors (401/403→disallow_all, 4xx→allow_all)
- `parse(lines)` (L81-152): Core parsing logic using state machine (0=start, 1=user-agent, 2=rules)
- `can_fetch(useragent, url)` (L154-181): Primary query method - determines if user agent can access URL
- `crawl_delay(useragent)` (L183-191): Returns crawl delay for user agent
- `request_rate(useragent)` (L193-201): Returns request rate limits for user agent
- `site_maps()` (L203-206): Returns discovered sitemap URLs

**Entry (L233-273)** - Represents a robots.txt entry (user-agent + rules)
- Contains lists of user agents, rule lines, delay, and request rate settings
- `applies_to(useragent)` (L253-264): Checks if entry matches user agent (case-insensitive, wildcard support)
- `allowance(filename)` (L266-273): Evaluates rules to determine access permission

**RuleLine (L215-231)** - Represents Allow/Disallow directive
- `__init__(path, allowance)` (L218-224): Normalizes path and sets permission flag
- `applies_to(filename)` (L226-227): Pattern matching for path rules

### Key Dependencies
- `urllib.parse`: URL parsing and encoding/decoding
- `urllib.request`: HTTP fetching of robots.txt files
- `collections.namedtuple`: RequestRate structure (L19)

### Architecture Patterns
- **State Machine Parser**: Uses 3-state parsing (start→user-agent→rules) in `parse()`
- **Fallback Hierarchy**: Specific entries checked before default entry (*) in queries
- **Error-Safe Parsing**: Validates numeric values before conversion, ignores malformed lines
- **URL Normalization**: Consistent URL encoding/decoding throughout

### Critical Behaviors
- Empty disallow path ("Disallow:") means allow all (L219-221)
- Default entry (user-agent: *) processed last and stored separately
- HTTP 401/403 errors trigger global disallow, other 4xx errors trigger global allow
- Sitemaps are independent of user-agent context
- User agent matching is case-insensitive and supports partial matching