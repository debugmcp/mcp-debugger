# Governance

This document describes how decisions are made in mcp-debugger. It exists so that users — including corporate and government adopters — can see exactly who is accountable for what.

## Ownership

mcp-debugger is stewarded by **Sycamore LLC**, which holds the GitHub organization, the `@debugmcp` npm scope, the `debugmcp` Docker Hub organization, and the PyPI project. The project is MIT-licensed; the license grant is irrevocable and does not depend on the steward.

## Roles

- **Maintainers** (listed in [MAINTAINERS.md](MAINTAINERS.md)) — merge authority, release authority, security-response authority.
- **Contributors** — anyone submitting issues or pull requests under [CONTRIBUTING.md](CONTRIBUTING.md).

## How changes land

mcp-debugger uses an **agent-first development model with human accountability**: AI coding agents produce most implementation work, while humans retain all trust decisions.

1. All changes go through pull requests — no direct pushes to `main` (enforced server-side by branch protection).
2. CI is the primary quality gate: required status checks (build/test on Linux and Windows, lint, container tests) must pass.
3. **A human maintainer makes every merge decision and every release decision.** Agents cannot merge, publish, or modify branch protection.
4. Releases are tagged by a maintainer and built/published by CI with pinned actions, OIDC trusted publishing, sigstore provenance, and SBOMs (see [SUPPLY-CHAIN-SECURITY.md](SUPPLY-CHAIN-SECURITY.md)).

## Decision-making

Day-to-day decisions are made by the lead maintainer. Significant directional changes (new language adapters, protocol-surface changes, deprecations) are proposed and discussed in GitHub issues before implementation — the issue tracker is the project's decision record.

## Security decisions

Vulnerability handling follows [SECURITY.md](SECURITY.md): private disclosure via GitHub Security Advisories or security@debugmcp.io, coordinated release of fixes, and public advisories after patches ship.

## Changes to this document

Changes to governance require a pull request approved by the lead maintainer.
