# tests\exploratory/
@children-hash: 537d6462b4fecf81
@generated: 2026-02-24T01:54:47Z

## Exploratory Testing Results Archive

This directory contains test execution results from exploratory testing sessions validating debugging infrastructure across multiple deployment environments. The results provide comprehensive test coverage data for debugging service functionality in Docker, local SSE, and NPX tarball configurations.

### Test Environment Coverage

**Docker Environment (`results-docker.json`)**
- Container-based debugging with volume mounting
- Language detection and workspace path handling
- Multi-session concurrent debugging capabilities
- **Critical Issue**: Path resolution bug with workspace double-prefixing (`/workspace//workspace/`)

**Local SSE Environment (`results-local-sse.json`)**  
- Server-Sent Events based debugging service
- Comprehensive 15-test suite with 100% pass rate
- Full debugging workflow validation across Python, JavaScript, and Go
- Edge case handling and error condition testing

**NPX Tarball Environment (`results-npx-tarball.json`)**
- Package distribution validation testing
- Runtime debugging workflow verification
- Schema and output validation testing
- Clean 5-test suite with full pass rate

### Common Test Pattern Analysis

All environments validate core debugging capabilities through consistent test patterns:

1. **Language Support Discovery**: Enumeration of supported programming languages
2. **Debug Workflow Validation**: End-to-end debugging session lifecycle testing
3. **Session Management**: Multi-session handling and cleanup verification
4. **Error Handling**: Edge cases and invalid operation responses

### Key Insights

- **Performance Variance**: Test durations range from milliseconds (basic queries) to tens of seconds (full debug workflows)
- **Environment-Specific Issues**: Docker environment shows systematic path resolution problems while local and NPX environments maintain clean execution
- **Test Coverage**: Combined coverage spans tool enumeration, multi-language debugging, concurrent sessions, source context retrieval, and comprehensive error handling

### Data Structure

Each results file follows a consistent JSON schema with summary metrics (total/passed/failed counts) and detailed test case arrays containing execution names, status, and timing data. This standardized format enables cross-environment performance and reliability comparison.