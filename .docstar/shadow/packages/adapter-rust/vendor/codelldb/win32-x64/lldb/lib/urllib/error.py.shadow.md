# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/urllib/error.py
@source-hash: d12b3cc66af3f42a
@generated: 2026-02-09T18:11:16Z

## Purpose
Python urllib exception hierarchy providing structured error handling for HTTP and URL operations. Part of the standard library's urllib package, defining three core exception types with dual-purpose HTTPError that acts as both exception and HTTP response.

## Key Classes

### URLError (L19-33)
- **Base exception class** inheriting from OSError
- **Primary use**: Generic URL operation failures
- **Key attributes**: `reason` (error description), optional `filename`
- **Custom behavior**: Overrides `__init__` and `__str__` to break from typical OSError pattern
- **Note**: Sets `self.args` for OSError compatibility but doesn't follow errno/strerror convention

### HTTPError (L35-68)
- **Dual-purpose class**: Exception + HTTP response object via multiple inheritance
- **Inherits from**: URLError + urllib.response.addinfourl
- **Constructor params**: url, code, msg, hdrs, fp (L39)
- **Response attributes**: `code`, `msg`, `hdrs`, `fp`, `filename`
- **Properties**: `reason` (L57-59) maps to `msg`, `headers` (L61-67) with getter/setter for `hdrs`
- **Fallback handling**: Creates BytesIO() if fp is None (L45-46)
- **Design pattern**: Allows treating HTTP errors as valid responses in application logic

### ContentTooShortError (L70-74)
- **Specialized URLError** for incomplete downloads
- **Use case**: When actual download size != Content-Length header
- **Additional attribute**: `content` (partial downloaded data)

## Dependencies
- `io`: For BytesIO fallback in HTTPError
- `urllib.response`: For addinfourl mixin inheritance

## Architecture Notes
- **Exception hierarchy**: ContentTooShortError → URLError → OSError, HTTPError → URLError + addinfourl
- **Dual nature design**: HTTPError uniquely serves as both exception and response object
- **Compatibility layer**: URLError maintains OSError interface while customizing behavior
- **Export interface**: `__all__` explicitly defines public API (L16)