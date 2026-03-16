# Hull Moving Average (HMA) Indicator for NinjaTrader 8

## Purpose

This is a **test of the mcp-debugger .NET adapter**. The goal is to create a
real-world NinjaTrader indicator (Hull Moving Average), extract the algorithm
into a standalone .NET console app, and debug it using the locally installed
mcp-debugger to verify the debugger works correctly with .NET/C#.

## mcp-debugger (Local Installation)

mcp-debugger is the parent repository containing this file. It is an MCP server that gives AI agents step-through debugging via the Debug
Adapter Protocol. This local copy has been customized with a **.NET/C# debug
adapter** (`packages/adapter-dotnet/`) that uses netcoredbg (Samsung's
MIT-licensed .NET debugger) with a TCP-to-stdio bridge. It supports Python, JavaScript,
Rust, Go, and .NET/C#.

The mcp-debugger MCP tools are available in this session (e.g.,
`create_debug_session`, `set_breakpoint`, `start_debugging`, `get_variables`,
`step_over`, etc.).

## Before Writing Code: Read the Documentation

**IMPORTANT**: Before creating any NinjaScript code, review the scraped
NinjaTrader documentation in:
```
nt8-docs/text/
```

Key files to read first:
- `indicator.txt` — Indicator-specific methods and properties
- `developing_indicators.txt` — Levels 1-6 of indicator development
- `indicator_overview.txt` — Overview of the indicator framework
- `ninjascript_wizard.txt` — The wizard NinjaTrader provides for humans to
  create indicators. **Use the wizard's output structure as your template** —
  match the same regions, method ordering, property patterns, and naming
  conventions so your code is consistent with what NinjaTrader generates.
- `ninjascript_best_practices.txt` — Coding standards
- `addplot.txt` — How to add chart plots
- `onbarUpdate.txt` / `onstatechange.txt` — Core lifecycle methods

Review existing built-in indicators in `bin\Custom\Indicators\` (the `@`-prefixed
files) to see the patterns and conventions used by NinjaTrader's own indicators.

## NinjaTrader 8 Compilation Architecture

NinjaTrader 8 has its own built-in C# compiler. There is **no `.csproj` file**.
You place `.cs` files in the appropriate subfolder under `bin\Custom\` and
NinjaTrader compiles **all** NinjaScript files into a single `Custom.dll`
assembly. Key points:

- Indicators go in `bin\Custom\Indicators\`
- Strategies go in `bin\Custom\Strategies\`
- NinjaTrader compiles ALL `.cs` files, not just the one you're editing
- Compile errors from other files will appear alongside yours
- No external build tool or project file is needed

## What Is the Hull Moving Average?

The Hull Moving Average (HMA), developed by Alan Hull in 2005, is a technical
indicator that dramatically reduces the lag inherent in traditional moving
averages while maintaining curve smoothness. It achieves this by combining
Weighted Moving Averages (WMA) at different time scales.

### Formula

Given a period **n**:

1. **WMA half** = WMA(Close, n/2)
2. **WMA full** = WMA(Close, n)
3. **Delta** = 2 * WMA_half - WMA_full
4. **HMA** = WMA(Delta series, sqrt(n))

The "2 * half - full" trick amplifies recent price action, and the final WMA
over sqrt(n) bars smooths the result without reintroducing lag.

## Task Breakdown

### Step 1: Create the NinjaTrader Indicator

Place `HullMA.cs` in:
```
bin\Custom\Indicators\HullMA.cs
```

Use the NinjaScript wizard-style template. Match the conventions of the
existing `@`-prefixed indicators in that directory.

### Step 2: Create a Standalone Console App for Debugging

Create `HullMAConsole.cs` in the `.claude\` working directory. This extracts
the same HMA algorithm into plain C# with sample price data so it can be
debugged outside of NinjaTrader. **No `.csproj` is needed for the NinjaTrader
indicator**, but the console app does need a simple `.csproj` targeting
`net8.0` with `DebugType` set to `portable`.

Mark good breakpoint candidates with comments:
- The line calling `CalculateWMA` for the half-period (inspect `wmaHalf`)
- The delta calculation: `2 * wmaHalf - wmaFull` (inspect all three values)
- The final HMA from `CalculateWMAFromBuffer` (inspect `hma`)

### Step 3: Build and Run the Console App

```bash
cd .claude
dotnet build -c Debug
dotnet run -c Debug
```

Verify the output looks correct.

### Step 4: Debug with mcp-debugger (Interactive)

**Do NOT start debugging autonomously.** When the indicator and console app
are ready, tell the human. The human will then interactively direct you to:
- Add breakpoints at specific lines
- Step through the code
- Inspect variables
- Verify correctness

This interactive testing is the whole point — it validates that the
mcp-debugger .NET adapter works correctly in a real-world scenario.

### If You Find a Debugger Bug

If the mcp-debugger tools fail or behave incorrectly, write the issue to:
```
.claude\mcp-debugger-issues.md
```

Include: what tool was called, what arguments were passed, what happened,
and what you expected. The MCP debugger agent (a separate Claude instance
working in the mcp-debugger repo) will read this file and fix the issue.

## Directory Layout

```
<NinjaTrader 8 root>\
├── bin\Custom\Indicators\
│   ├── @SMA.cs, @EMA.cs, ...    ← built-in indicators (review these)
│   └── HullMA.cs                 ← your indicator goes here
├── .claude\                        ← your working directory
│   ├── HullMA-Guide.md           ← this file
│   ├── HullMAConsole.cs          ← standalone debuggable app
│   ├── HullMAConsole.csproj      ← project file for console app
│   ├── mcp-debugger-issues.md    ← write debugger bugs here
│   └── dotnet-debug-adapter-spec.md ← existing reference doc
└── nt8-docs\text\                 ← scraped NinjaTrader documentation
    ├── indicator.txt
    ├── developing_indicators.txt
    ├── ninjascript_wizard.txt
    └── ... (hundreds of reference files)
```

## Algorithm Notes

- The **warmup period** is `period - 1` bars. During warmup, output the raw
  price instead of an HMA value.
- Even after warmup, the delta ring buffer takes an additional `sqrt(period)`
  bars to fill completely. Early HMA values will be dampened.
- Weights in WMA go from highest (newest bar) to lowest (oldest bar):
  `weight = len - i` where `i = 0` is the most recent bar.
