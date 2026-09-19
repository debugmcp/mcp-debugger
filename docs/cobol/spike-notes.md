> Verbatim record of the issue #759 M0 spike (2026-09-19), kept as the source of measured facts; the user-facing guide is [README.md](README.md).

# COBOL adapter spike notes (M0, 2026-09-19)

Measured with vendored CodeLLDB 1.11.8 driven directly over DAP (throwaway driver), GnuCOBOL 3.2 on
Windows (MSYS2 mingw64, gcc 15.2) and Ubuntu 26.04 (gcc 15.2), GnuCOBOL 3.1.2 on Ubuntu 24.04.
Every gate below is an observation, not an inference. Tracking issue: #759.

## Verdict

CodeLLDB passes every gate; the GDB native-DAP runner-up is not needed. The COBOL semantic layer
(manifest + decoder + DAP shim) is required exactly as planned: the engine exposes addresses, bytes,
line mapping and pending breakpoints, and nothing COBOL-shaped.

## Compiler facts (cobc)

- Build command that works on all three: run with **cwd = artifact dir** and the bare `--save-temps`:
  `cobc -x -g -fdump=ALL --save-temps -t <name>.lst -ftsymbols -A "-O0 -gdwarf-4" [-std=…] [-I dir] [--debug] -o <exe> <abs sources…>`
  with env `COBC_GEN_DUMP_COMMENTS=1`. `--save-temps=<dir>` fails on Windows 3.2
  ("could not move temporary file") and leaves no generated C. `-C` (translate only) writes the same
  `.c/.c.h/.c.l.h` into cwd without invoking the C compiler (prebuilt-binary manifest path).
- MSYS2 `cobc` needs `COB_CONFIG_DIR=<prefix>/share/gnucobol/config` (and `COB_COPY_DIR`) when
  spawned outside an MSYS2 shell; its built-in default is the MSYS-rooted `/mingw64/share/…` which
  does not resolve from Node/PowerShell/Git Bash. The debuggee needs `<prefix>/bin` on PATH for
  `libcob-4.dll`.
- `-A "-O0 -gdwarf-4"` is accepted by 3.1.2 and 3.2. Without `-gdwarf-4` on MinGW (DWARF-5 default),
  `setBreakpoints` on `.cob` lines answers `verified:false, "Resolved locations: 0"` and the program
  runs through. With DWARF-4, LLDB still logs three
  `DIE has DW_AT_ranges(DW_FORM_sec_offset …) … range extraction failed` errors per launch on
  Windows; breakpoints, frames, statics and stepping all work regardless.
- Generated C (identical shapes in 3.1.2 and 3.2):
  - body function `static int <PROG>_ (const int entry[, cob_u8_t *b_N …])`, entry `int <PROG> (…)`;
    LINKAGE bases are parameters of the body function (`b_19`), LOCAL-STORAGE is the function-local
    `cob_local_ptr` (+ offset), WORKING-STORAGE are file/function statics `b_N`.
    3.1.2 additionally has a `<PROG>_module_init` function.
  - `static cob_u8_t b_N[size]`, `static cob_field f_N = {size, b_N + off, &a_N}; /* NAME */` and
    `static unsigned char *b_N = NULL; /* LINKAGE-NAME */` live in **`<prog>.c.l.h`**;
    `static const cob_field_attr a_N = {0x<type>, digits, scale, 0x<flags>, NULL|&pic}` and the literal
    constants `static const cob_field c_N = {len, (cob_u8_ptr)"A", &a_M}` live in `<prog>.c.h`.
    3.1.2 writes `COB_SET_FLD(f0, …` (no space), 3.2 `COB_SET_FLD (f0, …`.
  - Dump routine per program: `cob_dump_output ("WORKING-STORAGE"|"LOCAL-STORAGE"|"LINKAGE")`, then
    `cob_dump_field_ext (<lvl>, "<NAME>", &f_N | COB_SET_FLD (f0, <size>, <dataExpr>, &a_N), <offset>, <idx>[, i_1, <elemSize>UL]);`
    OCCURS as `{ int i_1; int max_1 = 5|cob_get_numdisp (b_33, 1); if (max_1 > 9) max_1 = 9; for (i_1=0; i_1 < max_1; i_1++) { … /* OCCURS 1 5 */ } }`,
    ODO groups also get a runtime size (`COB_SET_FLD (f0, cob_get_numdisp (b_33, 1), b_34, &a_3)`),
    LINKAGE items behind `/* Check LINKAGE address for NAME */ if (b_19 == NULL) {…} else {…}` with
    `b_19 = last_b_19;` restored first, REDEFINES as
    `/* cob_dump_field_ext ( 1, "WS-ALT", COB_SET_FLD (f0, 8, b_36, &a_20), 0, 0); REDEFINES */`, 88s as
    `/* cob_dump_field_ext (88, "WS-STATUS-CLOSED", COB_SET_FLD (f0, 1, b_24 + 24, &a_9), 0, 0); VALUE (cob_field *)&c_13 OR (cob_field *)&c_14 */`.
    `RETURN-CODE` appears as level 77 with `(cob_u8_t *)&b_2`.
  - Statement mapping: `/* Line: 37 : MOVE : <file> */` → `#line 37 "<abs cobol file>"` →
    `module->statement = STMT_MOVE;` → `#line <n> "hello.c"` → the code. Paragraphs:
    `/* Line: 36 : Paragraph 1000-INIT : <file> */`, 3.2 also emits `PARAGRAPH_1000__INIT_l_5:` labels,
    3.1.2 emits only `SECTION_…` labels — use the comments for the procedure map. Copybook statements
    carry the copybook path in `#line`. DATA DIVISION items also get `#line` rows (VALUE initialisation),
    so a step can land on a DATA DIVISION line.
  - Listing (`-t x.lst -ftsymbols`): `SIZE TYPE LVL NAME PICTURE` rows incl. `OCCURS 5`,
    `X, OCCURS 1 TO 9`, `9(8), REDEFINES WS-RAW`, `S9(17)V9(17) COMP-2`, `CONDITIONAL 88 …`; no offsets.
- Attrs seen: `PIC S9(9) COMP` = `{0x11, 9, 0, 0x0821}` default / `0x0021` ibm (BINARY_SWAP+HAVE_SIGN,
  default adds BINARY_TRUNC); `COMP-5` = `{0x11, 9, 0, 0x0041}` (REAL_BINARY, native order);
  `COMP-3 S9(7)V99` = `{0x12, 9, 2, 0x0001}`; `COMP-2` = `{0x14, 34, 17, 0x0201}`; `PIC 9(4) COMP` =
  `{0x11, 4, 0, 0x0820}`; DISPLAY `S9(5)V99` = `{0x10, 7, 2, 0x0001}`.
- Bytes at a stop (identical Windows/Linux, default and `-std=ibm`): `S9(5)V99 = -123.45` →
  `30 30 31 32 33 34 75` (`001234u`: trailing ASCII overpunch, digit|0x40); `S9(9) COMP = -123456789`
  → `f8 a4 32 eb` (big-endian two's complement); `S9(9) COMP-5 = 987654321` → `b1 68 de 3a`
  (little-endian native); `S9(7)V99 COMP-3 = -12345.67` → `00 12 34 56 7d`; `+1500.00` → `00 01 50 00 0c`;
  `COMP-2 3.14159` → IEEE-754 little-endian; `9(4) COMP = 6` → `00 06`.

## Engine facts (CodeLLDB 1.11.8)

- R1 addresses: `evaluate {expression: "/nat (unsigned long long)(b_24 + 24)", frameId, context: "variables"}`
  resolves file statics **per compilation unit** in the selected frame (`&b_2` differs between the
  `CALLMAIN_` and `CALLSUB_` frames of one statically linked exe), LINKAGE parameters (`b_19`) and
  `cob_local_ptr` resolve in the callee frame and are undeclared in the caller frame. libcob functions
  (`cob_get_numdisp`) are **not** callable from expressions on Windows — the shim decodes ODO counts itself.
  Results come back as decimal strings.
- R2 `readMemory {memoryReference: "0x…", count}` works on both platforms.
- R3 line breakpoints in `.cob` and `.cpy` files bind (`verified:true` at set time, then a
  `breakpoint changed` event with "Resolved locations: 1"), stop with the `.cob`/`.cpy` path as the frame
  source; frame 0 is `<PROG>_`, frame 1 `<PROG>` in `<prog>.c`, then `main`, then CRT frames flagged
  with the `@` sigil.
- R4 `setFunctionBreakpoints [{name: "cob_runtime_error"}]` is accepted pending (`verified:false`),
  binds when libcob loads and stops with `reason: "breakpoint"`, `hitBreakpointIds: [id]`; frames:
  `cob_runtime_error` ← `cob_check_subscript` ← `cob_check_subscript_inline` (in the generated C) ←
  `<PROG>_` at a **generated-C line** ← `<PROG>` ← `main`. The format string is readable as
  `/nat (const char*)$rcx` (Win64) / `$rdi` (SysV): `"subscript of '%s' out of bounds: %d"`,
  `"'%s' (Type: %s) not numeric: '%s'"`. `STOP RUN` never hits it (hello exits 0 with the bp armed).
  Continuing after the stop lets libcob print its message + dump and exit 1.
- R6 stdin: the launch `stdio: [file, null, null]` key does **not** feed the file (Windows: ACCEPT reads
  empty; Linux: the program blocks forever). What works on both: `preRunCommands: ["settings set target.input-path <file>"]`.
  On Windows an inherited stdin handle on the adapter process also works (debuggee inherits it).
- R7 `variablesReference` handles are small sequential integers (max seen 1024) → the shim's
  `[1<<30, 1<<31)` band is safe.
- R10 frame names: body `<PROG>_`, entry `<PROG>`; `stepIn` at CALL walks `<PROG>` (entry) → `<PROG>_module_init`
  (3.1.2 only) → `<PROG>_` at `.c.l.h`/`.c` lines → the callee's DATA DIVISION line (LOCAL-STORAGE VALUE
  init) → first PROCEDURE line. libcob frames have no debug info and are skipped by LLDB automatically.
- R11 stepping: a raw `next` from a COBOL line stops on ~10 generated-C lines (`hello.c:127…138`) before
  the next COBOL line; the shim step loop is required. `stepOut` from `CALLSUB_` stops in `CALLSUB`
  (sub.c:60), the next in `CALLMAIN_` at main.c:139 (the CALL statement's generated line) — so
  `step_out` = one `stepOut` + the `next` loop to the next PROCEDURE DIVISION line.
- R12 lifecycle: `exited {exitCode}` + `terminated` after STOP RUN; `noDebug: true` → `initialized`
  still sent, `setBreakpoints`/`setFunctionBreakpoints` refused with
  `Internal debugger error: Not supported in noDebug mode.`, `launch` succeeds, program runs to exit
  (same as the cpp measurement). Output: Linux → DAP `output` events (`stdout` category, CRLF
  line ends); Windows → the adapter process's stdout (inherit path) — the shim must let CodeLLDB
  inherit its stdio and never write there itself.
- R13 modules: a `.cob` breakpoint in a `-m` module set before launch stays `verified:false`, gets a
  `breakpoint changed … verified:true` event when the module loads, and hits inside `MOD1_`. Re-sending
  `setBreakpoints` before the load also returns `verified:false` without harm.
