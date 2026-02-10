# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/urllib/robotparser.py
@source-hash: 389b811835f9a3ba
@generated: 2026-02-09T18:12:23Z

## Purpose
Python implementation of the robots.txt exclusion protocol parser, following RFC specifications from robotstxt.org. Provides functionality to fetch, parse, and query robots.txt files for web crawling compliance.

## Key Classes and Functions

### RobotFileParser (L22-213)
Main class for handling robots.txt files with comprehensive parsing and querying capabilities.

**Core State:**
- `entries` (L29): List of Entry objects for specific user-agents
- `default_entry` (L31): Entry object for wildcard (*) user-agent
- `sitemaps` (L30): List of sitemap URLs
- `disallow_all/allow_all` (L32-33): Global access flags based on HTTP errors

**Key Methods:**
- `__init__(url='')` (L28-35): Initialize with optional URL
- `read()` (L59-70): Fetch robots.txt via HTTP, handles 401/403 (disallow all) and 4xx errors (allow all)
- `parse(lines)` (L81-152): State machine parser (0=start, 1=saw user-agent, 2=saw rules)
- `can_fetch(useragent, url)` (L154-181): Primary query method - checks if user-agent can access URL
- `crawl_delay(useragent)` (L183-191): Returns crawl delay for user-agent
- `request_rate(useragent)` (L193-201): Returns request rate limits
- `site_maps()` (L203-206): Returns sitemap URLs

### Entry (L233-273)
Represents a robots.txt entry for specific user-agents.

**Attributes:**
- `useragents` (L236): List of user-agent strings this entry applies to
- `rulelines` (L237): List of RuleLine objects (allow/disallow rules)
- `delay` (L238): Crawl delay in seconds
- `req_rate` (L239): RequestRate namedtuple

**Key Methods:**
- `applies_to(useragent)` (L253-264): Checks if entry matches user-agent (case-insensitive substring matching)
- `allowance(filename)` (L266-273): Returns boolean permission based on rule precedence

### RuleLine (L215-231)
Represents individual Allow/Disallow directives.

**Attributes:**
- `path` (L223): URL-encoded path pattern
- `allowance` (L224): Boolean - True for Allow, False for Disallow

**Key Methods:**
- `applies_to(filename)` (L226-227): Pattern matching - supports wildcard (*) and prefix matching

### Supporting Elements
- `RequestRate` (L19): Named tuple for request rate limits (requests/seconds)
- `_add_entry(entry)` (L72-79): Internal method handling wildcard vs specific entries

## Dependencies
- `urllib.parse`: URL parsing and encoding
- `urllib.request`: HTTP fetching
- `collections`: Named tuple support

## Architecture Patterns
- **State Machine Parser**: 3-state parser for robots.txt syntax
- **Precedence System**: Specific user-agents checked before default (*) entry
- **Error-based Access Control**: HTTP errors determine global allow/disallow state
- **URL Normalization**: Consistent URL encoding/decoding throughout

## Critical Behavior
- Empty disallow directive (`Disallow:`) allows all access (L219-221)
- First matching rule wins in allowance checking (L271-272)
- Parser handles malformed syntax gracefully (validates digits before conversion)
- Sitemaps are independent of user-agent context (L145-150)