# Coverage Analysis - Auto-Display Setup

## What Changed

Now when you run `npm run test:coverage`, you'll automatically see a coverage analysis at the end showing which files to focus on for testing.

## Automatic Display (Compact)

After running:
```bash
npm run test:coverage
```

You'll automatically see:
```
══════════════════════════════════════════════════════════════════════
 COVERAGE ANALYSIS - Files to focus on (sorted by impact):
══════════════════════════════════════════════════════════════════════
Overall: 83.6% | Focus on files with most uncovered lines
──────────────────────────────────────────────────────────────────────
Lines  Cov%  Impact  File
──────────────────────────────────────────────────────────────────────
   86   72%   +2.7%  src/server.ts
   62   81%   +2.0%  src/session/session-manager-operations.ts
   53   71%   +1.7%  src/proxy/dap-proxy-worker.ts
   ... (top 10 files)
──────────────────────────────────────────────────────────────────────
Run "npm run test:coverage:analyze" for detailed analysis
══════════════════════════════════════════════════════════════════════
```

## Manual Commands (Detailed)

For detailed analysis:
```bash
# Just analyze existing coverage (detailed view)
npm run test:coverage:analyze

# Generate coverage and analyze (detailed view)
npm run coverage:analyze
```

## Summary

- **Automatic**: Compact view after every `npm run test:coverage`
- **Manual**: Detailed view with `npm run test:coverage:analyze`
- **No memorization needed**: The analysis appears automatically!

The table shows files sorted by number of uncovered lines (not coverage %), so you know exactly where to focus your testing efforts for maximum impact.
