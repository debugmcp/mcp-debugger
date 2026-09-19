# COBOL Debugging with Debug MCP Server

Step-through debugging for GnuCOBOL programs via **CodeLLDB** — the same vendored LLDB-based engine the Rust and C/C++ adapters use — with a COBOL semantic layer in front of it, so a paused program shows `WS-TOTAL = -123.45` rather than a `b_8` byte array. Language id: `cobol`.

Written for a team migrating a mainframe (IBM Enterprise COBOL) batch application to GnuCOBOL: the [migration recipe](#mainframe-migration-recipe) below is the launch configuration such a program usually needs. The measured facts behind every claim on this page are in [spike-notes.md](spike-notes.md) (issue #759, milestone M0).

## Architecture

```
MCP Client → mcp-debugger → proxy worker → cobol-shim (Node) → CodeLLDB (vendored) → LLDB → your program
                                                ▲
                                   <src>.cobol-symbols.json (from cobc's generated C)
```

- **cobc → native executable with DWARF.** The adapter compiles a `.cob`/`.cbl`/`.cobol` source with GnuCOBOL into a normal native executable carrying DWARF-4 line tables, so CodeLLDB binds line breakpoints in `.cob` and `.cpy` files and reports stops with the COBOL source as the frame location (spike R3).
- **Vendored CodeLLDB.** Same binary the Rust and C/C++ adapters use (`packages/codelldb-common`, one copy per platform, downloaded during `pnpm install`; npm installs get it via the `@debugmcp/codelldb-*` platform packages; `CODELLDB_PATH` overrides). No system LLDB or gdb.
- **The DAP shim.** CodeLLDB alone exposes addresses, bytes, line mapping and pending breakpoints — nothing COBOL-shaped. The adapter process mcp-debugger spawns is `node cobol-shim.js --port <n> --manifest-dir <dir> … -- <codelldb> …`: the shim spawns CodeLLDB itself, forwards everything it does not understand untouched, and synthesises the COBOL parts (scopes, decoded values, `evaluate` on data-names, the statement step loop, the runtime-error stop) from a **symbol manifest** plus CodeLLDB's own `/nat` expressions and `readMemory` (R1, R2).
- **The manifest comes from the compiler.** `cobc -fdump=ALL` makes the generated C carry a dump routine that names every data item with its level, storage expression, offset, size, attribute (type, digits, scale, flags) and OCCURS loops; `COBC_GEN_DUMP_COMMENTS=1` adds REDEFINES and 88-level conditions as comments. The builder parses that (cross-checked against the `-t … -ftsymbols` listing) into `<src>.cobol-symbols.json`, one per translation unit. The shapes are identical in GnuCOBOL 3.1.2 and 3.2.

## Prerequisites

- **CodeLLDB** — vendored; nothing to install.
- **GnuCOBOL 3.1.2 or 3.2** (`cobc`) for source launch and for COBOL-shaped variables. Verified: 3.2 on Windows (MSYS2 mingw64, gcc 15.2) and Ubuntu 26.04, 3.1.2 on Ubuntu 24.04. macOS/Homebrew was not measured in the spike.
  - **Ubuntu/Debian**: `sudo apt install gnucobol3`
  - **macOS**: `brew install gnucobol`
  - **Windows**: MSYS2, then `pacman -S mingw-w64-x86_64-gnucobol`
- **Locating cobc**: `COBC_PATH` (must exist) → the first `cobc` on PATH → well-known install directories (`C:\msys64\{mingw64,ucrt64,clang64}\bin`, `C:\GnuCOBOL\bin`; `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`). The first candidate that answers `cobc --version` wins; `mcp-debugger doctor cobol` shows which.
- **MSYS2 fact (Windows)**: MSYS2's `cobc` defaults `COB_CONFIG_DIR` to the MSYS-rooted `/mingw64/share/gnucobol/config`, which does not resolve from Node/PowerShell/Git Bash — every compile fails with `configuration error: …\default.conf: No such file or directory`. The adapter sets `COB_CONFIG_DIR` (and `COB_COPY_DIR`) to `<prefix>/share/gnucobol/{config,copy}` when those directories exist and you have not set them, and prepends `<prefix>/bin` to PATH for both the compile (cobc shells out to `gcc`) and the launch (the debuggee needs `libcob-4.dll`).
- **Prebuilt executables on a host without cobc**: the launch is refused unless `MCP_COBOL_ALLOW_PREBUILT=true` (implied by `MCP_CONTAINER=true`); without cobc there is no manifest, so variables show only the engine's C view.

### Compilation Requirements

What the adapter runs (cwd = the artifact directory, env `COBC_GEN_DUMP_COMMENTS=1`):

```
cobc -x -g -fdump=ALL --save-temps -t <name>.lst -ftsymbols -A "-O0 -gdwarf-4" \
     [-std=<dialect>] [-fixed|-free] [-I <dir>]… [--debug] [<cobcFlags>…] \
     -o <artifactDir>/<name>[.exe] <absolute sources…>
```

| Flag | Why |
|---|---|
| `-g` | DWARF plus `#line` rows back to the `.cob`/`.cpy` files — without it breakpoints answer `Resolved locations: 0` |
| `-fdump=ALL` | Emits the dump routine the manifest is parsed from |
| `--save-temps` (bare) | Keeps the generated `.c`/`.c.h`/`.c.l.h` in the cwd. `--save-temps=<dir>` fails on Windows 3.2 ("could not move temporary file") and leaves no C, so the adapter runs cobc *inside* the artifact directory instead |
| `-t <lst> -ftsymbols` | Listing with `SIZE TYPE LVL NAME PICTURE` rows, the cross-check for pictures, OCCURS and REDEFINES |
| `-A "-O0 -gdwarf-4"` | `-O0` for predictable stepping; `-gdwarf-4` because MinGW gcc defaults to DWARF-5, whose line tables LLDB cannot read from PE-COFF (line breakpoints never bind). Accepted by 3.1.2 and 3.2, harmless on Linux |
| `--debug` | Only with `runtimeChecks: true`: libcob subscript/ODO/reference-modification/numeric checks, i.e. what the runtime-error stop needs |
| absolute sources | The DWARF `#line` paths then equal the breakpoint paths mcp-debugger sends |

Even with DWARF-4, LLDB logs three `DIE has DW_AT_ranges(DW_FORM_sec_offset …) … range extraction failed` errors per launch on Windows. Breakpoints, frames, statics and stepping work regardless; ignore them.

**Artifact layout.** Everything lands beside the source, one directory per build key:

```
<dir of program>/.debug-mcp/cobol/<name>/
  latest.json                      # points at the newest key directory
  <buildKey>/
    <name>[.exe]                   # the executable (or <name>.dll/.so/.dylib for a module)
    <name>.lst                     # cobc listing
    <src>.c  <src>.c.h  <src>.c.l.h
    <src>.cobol-symbols.json       # the manifest, one per translation unit
    manifest-index.json  build.json
```

The build key hashes the `cobc --version` banner, the flags (minus `-o`/`-t` and absolute paths) and the *contents* of every source and of every copybook the previous build recorded, so editing a copybook rebuilds too. A change gets a fresh key directory — a still-running executable is never overwritten in place — and the three newest directories are kept (a directory a running debuggee still locks is skipped and pruned next time). `forceRebuild: true` recompiles even when the key matches. Compiles time out after 180 s.

## Debugging Modes

### Launch Mode

`program` (the `scriptPath` of `start_debugging`) is either a **COBOL source** (`.cob`, `.cbl`, `.cobol` — compiled as above) or a **prebuilt executable**. Copybooks (`.cpy`, `.copy`) are never a program. The COBOL-specific keys below go in `adapterLaunchConfig` (the documented home for language-specific launch settings; the e2e tests use it) — `dapLaunchArgs` forwards them to the adapter as well, and `adapterLaunchConfig` wins when both name a key. Relative entries resolve against `cwd`, so pass absolute paths.

| Key | Meaning |
|---|---|
| `sources` | Extra `.cob` files compiled into the same executable (static link, `CALL "CALLSUB"`), or — for a prebuilt executable — the sources to regenerate its manifest from |
| `modules` | Sources built as dynamically CALLed modules (`cobc -m`, one artifact directory each); their directories are prepended to `COB_LIBRARY_PATH` for the launch |
| `dialect` | `-std=<dialect>`: `ibm`, `mf`, `cobol85`, `default`, … |
| `format` | `"fixed"` → `-fixed`, `"free"` → `-free`; omitted → cobc's own default (fixed for `.cob`) |
| `copybookDirs` | `-I <dir>` search directories. cobc runs in the artifact directory, so copybooks next to the source need this |
| `cobcFlags` | Extra flags, verbatim, after the adapter's own (so they can override) |
| `runtimeChecks` | `true` → `--debug`: all libcob runtime checks. Changes behaviour — a bad subscript aborts instead of reading past the table — and is what makes the [runtime-error stop](#runtime-errors) fire |
| `stdinFile` | File fed to the debuggee's stdin for `ACCEPT … FROM SYSIN`. Implemented as `settings set target.input-path <file>` — CodeLLDB's own `stdio` launch key does not feed a file on either platform (R6) |
| `engineScopes` | `true` also lists CodeLLDB's own scopes (Local/Static/Global/Registers) after the COBOL ones |
| `manifestDirs` | Directories with existing `*.cobol-symbols.json` files (skips regeneration for a prebuilt executable) |
| `forceRebuild` | Recompile even when the build key matches |
| `args`, `cwd`, `env` | Top-level `start_debugging` keys, forwarded to the program; `env` is merged over the adapter's own PATH/`COB_*` additions |
| CodeLLDB keys | `initCommands`, `preRunCommands`, `postRunCommands`, `sourceMap`, `sourceLanguages`, `expressions`, `targetCreateCommands`, `processCreateCommands`, … pass through untouched |

#### Mainframe migration recipe

```json
{
  "scriptPath": "/proj/src/PAYROLL.cbl",
  "adapterLaunchConfig": {
    "dialect": "ibm",
    "format": "fixed",
    "copybookDirs": ["/proj/copybook"],
    "runtimeChecks": true,
    "stdinFile": "/proj/test/sysin.txt"
  },
  "env": {
    "DD_INFILE": "/proj/test/input.dat",
    "COB_FILE_PATH": "/proj/test/data"
  }
}
```

- `dialect: "ibm"` compiles under `-std=ibm`. Measured difference from the default: a `PIC S9(9) COMP` item carries attribute flags `0x0021` instead of `0x0821` — `BINARY_SWAP` and `HAVE_SIGN` stay, `BINARY_TRUNC` is dropped — so COMP items behave as on the mainframe rather than truncating to the picture.
- `format: "fixed"` for column-7/8-72 sources; free-format sources use `"free"`.
- `copybookDirs` is where the mainframe's PDS members went.
- `stdinFile` stands in for the SYSIN DD.
- `runtimeChecks: true` is the SSRANGE / S0C7 analogue: subscript, ODO, reference-modification and non-numeric-data checks call libcob's `cob_runtime_error`, where the [runtime-error stop](#runtime-errors) pauses before the abort.
- Files: GnuCOBOL's runtime resolves an `ASSIGN` name through the environment (`DD_<name>`, `dd_<name>`, `<name>`; `COB_FILE_PATH` prefixes bare names), and `env` reaches the program untouched. This part is GnuCOBOL runtime behaviour and was not exercised by the spike.

#### Prebuilt executables

- The binary must have been built with `cobc -g` (on MinGW also `-A -gdwarf-4`), or breakpoints answer `Resolved locations: 0`.
- Pass `sources` and the manifest is regenerated by a translate-only `cobc -C` (same flags minus `-x`, no C compiler run, nothing written next to the binary) into `.debug-mcp/cobol/<binary name>/<buildKey>/`. Use the same `dialect`, `format` and `copybookDirs` the binary was built with — the manifest describes the storage layout cobc produces for those options.
- Or pass `manifestDirs` pointing at an earlier build's artifact directory.
- With neither, the launch proceeds and the log warns `Prebuilt executable without "sources" or "manifestDirs": no COBOL symbol manifest, variables show the engine (C) view only` — `get_local_variables` is empty with a note, `get_scopes` shows CodeLLDB's Local/Static/Global, and `evaluate_expression` needs `/nat` C expressions (`b_8`, not `WS-TOTAL`).

### Attach Mode (by PID)

```
attach_to_process sessionId=... processId=<pid> adapterConfig={"manifestDirs": ["/proj/src/.debug-mcp/cobol/PAYROLL/<buildKey>"]}
```

- Numeric `processId` only; name/host/port attach is rejected (`COBOL attach requires a numeric processId`).
- `manifestDirs` supplies the `*.cobol-symbols.json` files for the running program (an earlier source launch's artifact directory, or a `cobc -C` run of your own). Regenerating the manifest from `sources` at attach time is milestone M2 of #759; until then, without `manifestDirs` the session shows the engine's C view.
- The target is held paused after attach (`stopOnEntry` is a top-level `attach_to_process` parameter and defaults to `true`; pass `false` to resume immediately).
- Recognised `adapterConfig` keys: `processId`/`pid`, `program` (CodeLLDB's explicit-binary hint), `waitFor`, `manifestDirs`, `engineScopes`, `initCommands`, `preRunCommands`, `postRunCommands`, `exitCommands`, `targetCreateCommands`, `processCreateCommands`, `expressions`, `sourceMap`, `sourceLanguages`, `relativePathBase`, `breakpointMode`. Unlisted keys are still forwarded, with a warning naming them.
- `detach_from_process` leaves the target running.
- **Linux**: `kernel.yama.ptrace_scope=1` (most distros' default) only allows attaching to child processes — `sudo sysctl kernel.yama.ptrace_scope=0`, or run the server with `CAP_SYS_PTRACE`. **Windows**: same-or-higher privilege than the target.
- Attach was not part of the M0 measurements; it goes through the same CodeLLDB attach the C/C++ adapter uses, plus the shim.

## Advanced CodeLLDB Features (pass-through)

Unrecognised launch keys flow through to CodeLLDB, so the [C/C++ guide's table](../cpp/README.md#advanced-codelldb-features-pass-through) applies: `initCommands`/`preRunCommands`/`postRunCommands` (LLDB scripting), `sourceMap`, `targetCreateCommands` (core dumps), `processCreateCommands` (gdbserver/rr), `expressions`. `stdinFile` is itself a `preRunCommands` entry the adapter prepends; your own `preRunCommands` run after it.

## Debugging Workflow

1. `create_debug_session` with `language: "cobol"`
2. `set_breakpoint` on a PROCEDURE DIVISION line of the `.cob` or `.cpy` file (breakpoints in copybook paragraphs bind and stop with the `.cpy` path as the frame source). Breakpoints in a `modules` entry stay `verified: false` until the module loads, then flip to verified and hit (R13). `statement: "<line text>"` addressing works as for every language
3. `start_debugging` with the source (or executable) path and the launch keys above. The compile happens here; a compile failure is the `start_debugging` error (`COBOL compile failed: …` with cobc's sanitized stderr)
4. Step (`step_over`/`step_into`/`step_out`), `continue_execution`, `pause_execution`
5. Inspect: `get_stack_trace`, `get_scopes`, `get_variables`, `get_local_variables`, `evaluate_expression` (see the next two sections)
6. `get_output` for DISPLAY output; `restart_debugging` rebuilds only when the build key changed
7. `close_debug_session`

## What the variables look like

- **Scopes**: `get_scopes` on a COBOL frame returns `WORKING-STORAGE`, `LOCAL-STORAGE` and `LINKAGE` (those present in the program), in that order; `get_local_variables` is their union in declaration order. FILE SECTION records were not measured in this milestone. On a frame that is not COBOL (paused inside libcob, or a program without a manifest) `get_local_variables` is empty with the note `No COBOL data division scopes at this frame (paused outside a COBOL program, or no symbol manifest for it).` and `get_scopes` shows whatever CodeLLDB reports. `engineScopes: true` appends CodeLLDB's scopes to COBOL frames too.
- **Values** are decoded from the raw bytes using the compiler's attribute and rendered in COBOL terms; each variable's `type` is COBOL vocabulary (`PIC S9(5)V99 COMP-3`, `PIC X(20)`, `GROUP (25 bytes)`, `POINTER`):

| Usage | Storage (measured) | Shown as |
|---|---|---|
| DISPLAY numeric `S9(5)V99` | `30 30 31 32 33 34 75` for `-123.45` (trailing ASCII overpunch) | `-123.45` — exactly `scale` fraction digits, `-` only when negative, never `+` |
| `COMP` / `BINARY` `S9(9)` | `f8 a4 32 eb` for `-123456789`: big-endian two's complement (`BINARY_SWAP`), default and `-std=ibm` alike | `-123456789` |
| `COMP-5` `S9(9)` | `b1 68 de 3a` for `987654321`: native (little-endian) order | `987654321` |
| `COMP-3` `S9(7)V99` | `00 12 34 56 7d` for `-12345.67`, `00 01 50 00 0c` for `+1500.00` | `-12345.67`; a non-packed byte pattern renders as `<invalid packed: 0x4142434445>` instead of failing the request |
| `COMP-1` / `COMP-2` | IEEE-754 float/double, native order | the float value |
| Alphanumeric `PIC X(n)` | the bytes | `"ALICE               "` — quoted latin1, `"`/`\` escaped, non-printables as `\xNN`, cut at 512 bytes with ` …(+N bytes)` |
| Group item | the concatenated bytes | a quoted preview of at most 64 bytes then ` … (N bytes)`; expands to its subordinate items |
| `OCCURS n` / `OCCURS … DEPENDING ON` | contiguous elements | expands to one child per occurrence; the DEPENDING ON count is read live from the program (the shim decodes it itself — libcob helpers are not callable from LLDB expressions on Windows) |
| `REDEFINES` | shares storage | listed as a sibling of the redefined item, decoded with its own picture |
| Level-88 condition | the parent's bytes against its VALUE list | `true` / `false` (THRU ranges and multiple values included) |
| `RETURN-CODE` | level 77 in the dump | an ordinary numeric item |

- The sign encoding actually found in storage is recorded (`ascii-overpunch`, `ebcdic-overpunch`, `separate`, `nibble`, `none`) — an EBCDIC-style overpunch in an ASCII program is worth noticing after a data migration.
- Values longer than the server-wide caps are truncated like every language's (`DEBUG_MCP_MAX_VARIABLE_VALUE_CHARS` etc.); the shim's own 512-byte text and 64-byte group previews apply first.

## Expressions (`evaluate_expression`)

Data-names, evaluated against the nearest COBOL frame:

| Expression | Meaning |
|---|---|
| `WS-TOTAL` | a data item |
| `WS-ID OF WS-GROUP`, `WS-ID IN WS-GROUP` | qualification, innermost first, as in COBOL |
| `WS-AMOUNT(3)` | subscript (1-based) |
| `WS-NAME(1:5)` | reference modification `(start:length)` |
| `LENGTH OF WS-NAME` | byte length of the item |
| `ADDRESS OF WS-GROUP` | the item's address |
| `WS-PACKED /hex` | the raw bytes as hex; `/raw` the undecoded bytes, `/addr` the address, `/len` the length |
| `/nat (unsigned long long)(b_24 + 24)` | escape hatch: the rest is a native CodeLLDB (C) expression, resolved in the selected frame — file statics resolve per compilation unit, `b_19`-style LINKAGE parameters and `cob_local_ptr` only in the callee frame (R1). Results are decimal strings |

## Stepping

- **Statement granularity.** Each COBOL statement expands to roughly ten generated-C line-table rows; a raw engine `next` stops on each of them (R11). The shim loops the engine's `next`/`stepIn`/`stepOut` until the next PROCEDURE DIVISION line, so `step_over` moves one COBOL statement.
- **`step_into` on `CALL`** lands on the callee's first PROCEDURE DIVISION statement; the entry wrapper, `<PROG>_module_init` (3.1.2 only) and the callee's DATA DIVISION VALUE-initialisation line the engine walks through on the way are stepped past (R10). A stop *can* still land on a DATA DIVISION line — those lines carry `#line` rows for VALUE initialisation.
- **`PERFORM` is entered like a `GO TO` in this milestone**: `step_over` on `PERFORM 1000-INIT` stops on the first statement of `1000-INIT`, not on the statement after the PERFORM. PERFORM-aware `step_over`/`step_out` and a synthesised PERFORM stack are milestone M3 of #759.
- **`step_out` from a CALLed program** is one engine `stepOut` (which lands in the caller's generated C at the CALL statement) plus the step loop, so it returns to the caller's **next statement**.
- **Stack traces** show the COBOL frames (`<PROG>_` at `file.cob:line`). The generated-C entry wrapper (`<PROG>`), `main`, the inline `cob_*` runtime checks and every libcob frame are hidden as internals; `get_stack_trace` with `includeInternals: true` shows them.
- **Frame names** are the compiler's: the body function is `<PROG>_`, the entry `<PROG>`.

## Runtime errors

Every libcob runtime check (subscript out of bounds, ODO count, reference modification out of range, non-numeric data in a numeric item) calls the exported `cob_runtime_error` right before the program aborts. The adapter exposes that as the exception filter `cobol_runtime_error`, implemented by the shim as a function breakpoint on `cob_runtime_error`:

- `breakOnExceptions` defaults to `"uncaught"` for launch sessions, and `"uncaught"` and `"all"` are the same one filter (COBOL has no catch semantics here); `"none"` disables it. Attach sessions apply no default.
- It needs `runtimeChecks: true` (`cobc --debug`) — without the checks compiled in there is nothing to call. `STOP RUN` never reaches it (a clean program exits 0 with the breakpoint armed).
- The breakpoint is accepted pending and binds when libcob loads (R4). At the stop the frames are `cob_runtime_error ← cob_check_subscript ← cob_check_subscript_inline ← <PROG>_ ← <PROG> ← main`; the runtime frames are internals, so the visible top frame is the offending statement in its paragraph. The pending message's format string is readable with `/nat (const char*)$rcx` (Windows x64) or `/nat (const char*)$rdi` (Linux x64): `"subscript of '%s' out of bounds: %d"`, `"'%s' (Type: %s) not numeric: '%s'"`.
- `continue_execution` lets libcob print its message and dump and exit 1 — inspect first.
- `examples/cobol/rterror.cob` (subscript 5 of a 3-element table) and `s0c7.cob` (`"ABCDE"` redefined as `COMP-3`, then `ADD`) are the two cases, i.e. the SSRANGE and S0C7 analogues.

## Program output

- `DISPLAY` output arrives in `get_output` (and the `debug://sessions/{id}/output` resource). Linux: CodeLLDB `output` events (`stdout` category, CRLF line ends). Windows: the debuggee inherits the adapter process's stdout, which mcp-debugger captures — the shim lets CodeLLDB inherit its stdio and never writes there itself (R12).
- `ACCEPT … FROM SYSIN`: use `stdinFile`. Without it an ACCEPT reads empty on Windows and blocks forever on Linux.
- Lifecycle after `STOP RUN`: `exited {exitCode}` then `terminated`, as for C/C++.

## Not supported yet

| Feature | Status |
|---|---|
| Function breakpoints (`function: "1000-INIT"`, sections, `PROGRAM-ID`) | Rejected up front; paragraph and section names are C labels, not functions. Milestone M3 of [#759](https://github.com/debugmcp/mcp-debugger/issues/759) |
| Logpoints (`logMessage: "total={WS-TOTAL}"`) | Rejected up front — `{WS-NAME}` interpolation needs the shim; M3 |
| PERFORM-aware `step_over` / `step_out`, synthesised PERFORM stack (`-fstack-extended`) | M3 (PERFORM is entered like `GO TO` today) |
| `cobcrun` launch, manifest regeneration from `sources` on attach | M2 |
| Writing variables (`setVariable`, `setExpression`) | Not supported; out of scope for v1 |
| `noDebug: true` | Honoured by the engine: `setBreakpoints` is refused with `Not supported in noDebug mode`, the program runs to exit (R12) |
| SCREEN SECTION, EBCDIC data, CICS/DB2/IMS preprocessors, NATIONAL / DEC64 / DEC128, level-66 RENAMES, `gcobol` (GCC 15) | Out of scope |
| FILE SECTION records as a scope | Not measured in this milestone |

## Docker

The image installs the `gnucobol3` package of its Ubuntu 26.04 base (GnuCOBOL 3.2) alongside g++/OpenJDK/lldb, and preloads the COBOL adapter, so source-file launch compiles in-container (into `.debug-mcp/cobol/` under `/workspace`) and the manifest is generated there. Prebuilt executables must be Linux-compiled for the image's architecture — a Windows/macOS-built binary mounted in is not debuggable by container LLDB (a binary-format fact, as for C/C++). `MCP_CONTAINER=true` implies `MCP_COBOL_ALLOW_PREBUILT`. Attach by PID inside the container needs `--cap-add=SYS_PTRACE` for non-descendant processes. See [Docker support](../docker-support.md).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `configuration error: …\default.conf: No such file or directory` | cobc cannot find its dialect configuration (MSYS2 outside its shell) | Set `COB_CONFIG_DIR=<prefix>/share/gnucobol/config`; the adapter does this automatically when cobc is found via `COBC_PATH`, PATH or a known install directory |
| Breakpoint stays `verified: false` with `Resolved locations: 0` and the program runs through | Binary built without `-g`, or on MinGW without `-A -gdwarf-4` (DWARF-5) | Let the adapter compile it, or rebuild with `cobc -g -A "-O0 -gdwarf-4"` |
| `libcob-4.dll not found` / program exits immediately on Windows | GnuCOBOL's `bin` directory is not on the debuggee's PATH | The adapter prepends cobc's `bin` when it finds cobc; otherwise add `<prefix>/bin` to PATH or pass it in `env` |
| Log warns `no COBOL symbol manifest, variables show the engine (C) view only` | Prebuilt executable without `sources`/`manifestDirs`, or `sources` given but cobc missing | Pass `sources` (with cobc installed) or `manifestDirs` |
| `GnuCOBOL (cobc) not found` | cobc not on PATH or in a known directory | Install GnuCOBOL or set `COBC_PATH`; for a prebuilt binary only, `MCP_COBOL_ALLOW_PREBUILT=true` |
| `DIE has DW_AT_ranges(DW_FORM_sec_offset …) … range extraction failed` (three per launch, Windows) | LLDB parsing MinGW DWARF | Harmless — breakpoints, frames, statics and stepping work |
| `COBOL compile failed: …` | cobc error (the tail of its stderr is in the message) | Fix the source; dialect problems usually mean the wrong `dialect`/`format` |
| `cobol-shim.js not found` | The adapter package was not built | `pnpm --filter @debugmcp/adapter-cobol run build` |
| Breakpoint in a module never verifies | The module has not loaded yet | Normal until the `CALL`; it flips to verified on load (R13). If it never loads, check `COB_LIBRARY_PATH`/`modules` |
| Runtime error never pauses | `runtimeChecks` not set | Pass `runtimeChecks: true` (recompiles with `--debug`) |
| Stop lands on a DATA DIVISION line | VALUE initialisation carries `#line` rows | Step once more |
| `cobc timed out after 180000 ms` | Very large compilation unit | Prebuild with cobc yourself and pass the executable plus `sources` |

## Additional Resources

- [spike-notes.md](spike-notes.md) — the M0 measurements this page is written from
- [GnuCOBOL Programmer's Guide](https://gnucobol.sourceforge.io/HTML/gnucobpg.html) and the [GnuCOBOL project](https://gnucobol.sourceforge.io/)
- [CodeLLDB manual](https://github.com/vadimcn/codelldb/blob/master/MANUAL.md)
- [`examples/cobol/`](../../examples/cobol/README.md) — the fixtures (hello, calls, copybook, dyn, rterror, s0c7, sysin, pause) with lines to break on
- [`skills/debugging/references/cobol.md`](../../skills/debugging/references/cobol.md) — agent-facing quick reference
- [C/C++ guide](../cpp/README.md) — the engine-level behaviour (CodeLLDB) this adapter inherits
- Tracking issue: [#759](https://github.com/debugmcp/mcp-debugger/issues/759)
