# Governance

This document describes how decisions are made in mcp-debugger. It exists so that users — including corporate and government adopters — can see exactly who is accountable for what.

## Ownership

mcp-debugger is stewarded by **Sycamore LLC**, which holds the GitHub organization, the `@debugmcp` npm scope, the `debugmcp` Docker Hub organization, and the PyPI project. The project is MIT-licensed; the license grant is irrevocable and does not depend on the steward.

## Roles

- **Maintainers** (listed in [MAINTAINERS.md](MAINTAINERS.md)) — merge authority, release authority, security-response authority.
- **Contributors** — anyone submitting issues or pull requests under [CONTRIBUTING.md](CONTRIBUTING.md).

## How changes land

mcp-debugger uses an **agent-first development model with human accountability**: AI coding agents produce most implementation work, and a managing agent merges it under a bar a human maintainer sets, while a human maintainer authorizes every release and stays accountable for the project.

1. All changes go through pull requests — no direct pushes to `main` (enforced server-side by branch protection).
2. CI is the primary quality gate. Branch protection requires the Linux build-and-test job and lint to pass before anything merges, and is configured to apply to administrators as well; the merge bar in item 3 asks for every other CI job as well (the Windows build, the container tests, the per-language host lanes, MCP conformance).
3. **A human maintainer sets the merge bar and authorizes every release; a managing agent merges changes that meet the bar and reports each one.** The bar asks for more than branch protection does: it includes every CI job that runs on the pull request passing, not only the two required ones, and a review by an agent other than the one that wrote the change. Dependabot's minor and patch updates are the exception: once approved, GitHub merges them automatically when the required checks pass. Changing the bar or branch protection is the maintainer's decision, not an agent's.
4. A release is tagged only on a maintainer's explicit word for that release, and is built and published by CI with pinned actions, OIDC trusted publishing, sigstore provenance, and SBOMs (see [SUPPLY-CHAIN-SECURITY.md](SUPPLY-CHAIN-SECURITY.md)).

## Decision-making

Day-to-day decisions are made by the lead maintainer, or by the managing agent under the lead maintainer's delegation, and the lead maintainer can reverse any of them. Significant directional changes (new language adapters, protocol-surface changes, deprecations) are proposed and discussed in GitHub issues before implementation — the issue tracker is the project's decision record.

## Security decisions

Vulnerability handling follows [SECURITY.md](SECURITY.md): private disclosure via GitHub Security Advisories or security@debugmcp.io, coordinated release of fixes, and public advisories after patches ship.

## Changes to this document

Changes to governance require a pull request approved by the lead maintainer.
