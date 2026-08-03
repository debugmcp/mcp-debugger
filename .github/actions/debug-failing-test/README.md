# debug-failing-test — CI that tells you *why*, not just *that*

> **Status: experimental.** The action works end-to-end but prompt/tool tuning is ongoing. Feedback via [issues](https://github.com/debugmcp/mcp-debugger/issues) is very welcome.

When a test fails in CI, this composite action launches [mcp-debugger](https://github.com/debugmcp/mcp-debugger) plus the Claude Code CLI, sets real breakpoints in the failing code path, inspects actual runtime values, and posts a root-cause analysis as a PR comment — instead of leaving you a red ✗ and a stack trace.

No IDE anywhere in the loop: the debugger runs headless on the CI runner. This is the kind of workflow an IDE-bound debug server structurally cannot do.

## Usage

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write   # for the analysis comment
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-python@v6
        with: { python-version: '3.12' }
      - run: pip install -r requirements.txt debugpy

      - name: Test, and debug on failure
        uses: debugmcp/mcp-debugger/.github/actions/debug-failing-test@main
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          test-command: 'pytest tests/ -x'
          language: 'python'
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `anthropic-api-key` | yes | — | API key for the Claude Code CLI |
| `test-command` | yes | — | Command that reproduces the failure |
| `language` | no | `python` | mcp-debugger language adapter to use |
| `test-file` | no | `''` | Failing test file, if known — narrows the investigation |
| `post-comment` | no | `true` | Post analysis as a PR comment |
| `github-token` | no | `github.token` | Token for the comment |

## Behavior

1. Runs `test-command`. If it passes, the action is a no-op (exit 0).
2. On failure, Claude gets the failure output plus mcp-debugger's tools, and is instructed to bisect with breakpoints and inspect real values — not to guess from source, and not to modify files.
3. The analysis (`mcp-debugger-analysis.md`: root cause, observed evidence, suggested fix) is posted as a PR comment when running in a `pull_request` context.
4. The job still fails (the test is still red) — this action explains failures; it doesn't mask them.

## Notes

- The language toolchain must be installed on the runner before this action runs (e.g. `pip install debugpy` for Python).
- Token cost is bounded by `--max-turns 60`; typical runs are far shorter.
- Nothing is committed or pushed; the agent has read-only source access plus the debugger.
