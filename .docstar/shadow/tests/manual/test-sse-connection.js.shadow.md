# tests/manual/test-sse-connection.js
@source-hash: 06e15248914f92c7
@generated: 2026-02-09T18:15:08Z

## Purpose
Manual testing script for Server-Sent Events (SSE) connection functionality, specifically designed to test a JSON-RPC over SSE implementation with session-based authentication.

## Core Functionality

**SSE Connection Setup (L1-11)**
- Imports EventSource polyfill for Node.js environment
- Establishes connection to `http://localhost:3001/sse` endpoint (L4-7)
- Registers connection open handler with logging (L9-11)

**Message Processing Pipeline (L13-49)**
- Main message handler processes incoming SSE events (L13-49)
- JSON parsing with graceful error handling for non-JSON messages (L17-48)
- Specifically listens for `connection/established` method to extract session ID (L19-22)

**Session-Based API Testing (L24-44)**
- Automatically triggers JSON-RPC POST request when session ID is received
- Uses extracted session ID in `X-Session-ID` header for authentication (L29)
- Sends `tools/list` JSON-RPC 2.0 request (L31-35)
- Includes full response/error handling chain (L37-43)

**Error Handling & Process Management (L51-57)**
- SSE error event listener with logging (L51-53)
- Process keep-alive mechanism using `process.stdin.resume()` (L56)
- User-friendly exit instructions (L57)

## Key Dependencies
- `eventsource`: Node.js EventSource polyfill for SSE client functionality
- Built-in `fetch` API for HTTP POST requests

## Architecture Notes
- Implements a typical SSE → session extraction → authenticated API call pattern
- Uses JSON-RPC 2.0 protocol for API communication
- Session-based authentication model with header-based session passing
- Graceful handling of mixed message types (JSON vs non-JSON)

## Usage Context
This is a development/testing utility for validating SSE connection establishment, session management, and subsequent authenticated API interactions in a local development environment.