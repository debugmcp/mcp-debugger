# @debugmcp/codelldb-linux-arm64

Prebuilt [CodeLLDB](https://github.com/vadimcn/codelldb) debug adapter binaries for **Linux arm64**.

This package is an internal binary payload for [`@debugmcp/mcp-debugger`](https://www.npmjs.com/package/@debugmcp/mcp-debugger), which lists all five platform variants as `optionalDependencies` (the esbuild pattern) so npm installs exactly the one matching your platform. It enables Rust and C/C++ debugging out of the box. You should not need to depend on this package directly.

## Contents

```
adapter/        codelldb executable + helper scripts
lldb/           liblldb + embedded Python runtime
lang_support/   language helpers (when shipped upstream)
version.json    vendored CodeLLDB version marker
```

The payload is extracted unmodified from the upstream `codelldb-linux-arm64.vsix` release asset, whose sha256 digest is pinned in the repository's `packages/codelldb-common/vendor-manifest.json`.

## Licenses

- CodeLLDB is MIT-licensed (© Vadim Chugunov).
- The bundled LLDB/LLVM components are licensed under Apache-2.0 WITH LLVM-exception.
- This package's own packaging files are MIT-licensed (see LICENSE).
