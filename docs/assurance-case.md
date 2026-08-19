# Security Assurance Case

This document argues *why* mcp-debugger's security controls are sufficient for its threat model. The controls themselves are specified in [SUPPLY-CHAIN-SECURITY.md](../SUPPLY-CHAIN-SECURITY.md) and [SECURITY.md](../SECURITY.md); this page connects threats to controls and states the residual risks plainly. It follows the structure expected by the [OpenSSF Best Practices](https://www.bestpractices.dev/projects/13543) assurance-case criterion: top claim, supporting argument, and evidence.

## Top-level claim

> An operator who installs a released mcp-debugger artifact and follows the [Trust Model](../SECURITY.md#trust-model) deployment guidance gets exactly the code this repository's CI built from the tagged commit, with no unvetted third-party code, and grants the connected MCP client no privileges beyond those the trust model explicitly documents.

The claim decomposes into three sub-claims: **(1)** released artifacts are authentic and traceable, **(2)** third-party code inside them is vetted and pinned, and **(3)** the runtime grants no undocumented privilege.

## Threat model

mcp-debugger is a debugger driven by an AI agent over MCP. The assets worth attacking are (a) the operator's machine and source code, (b) secrets visible in debugged processes, and (c) the distribution channel to every downstream user. The attacker classes we defend against:

| # | Threat | Vector |
|---|--------|--------|
| T1 | Malicious code injected into a release | Compromised CI dependency, mutated action tag, compromised upstream release asset, tampered build |
| T2 | Consumer receives a artifact that differs from what CI built | Registry account compromise, token theft, artifact substitution |
| T3 | Known-vulnerable dependency ships in a release | Dependency drift, unpatched advisory |
| T4 | Debugger capabilities abused beyond operator intent | Over-trusted MCP client, network-exposed endpoints, secret exfiltration from variable output |
| T5 | Maintainer account loss or unavailability | Single-maintainer project reality |

Out of scope (by design, documented in [SECURITY.md](../SECURITY.md#out-of-scope)): constraining what a debugger can do to processes the operator points it at. A debugger that cannot read memory or evaluate expressions is not a debugger; the trust boundary is the deployment.

## Argument: how the controls counter the threats

**T1 — build-time injection.** Every GitHub Action is SHA-pinned (tag mutation is inert). `pnpm-lock.yaml` pins every npm dependency by SHA-512; CI installs with `--frozen-lockfile --ignore-scripts`. Python CI tooling installs with `pip --require-hashes`. The two vendored debug engines (js-debug, CodeLLDB) are the largest third-party blobs we ship; because GitHub release assets are mutable, both vendor pipelines verify downloads against committed SHA-256 manifests and hard-fail on mismatch — "same version" is never trusted to mean "same bytes". Dependabot cooldown windows (3–7 days) mean a compromised upstream release is public for days before any update PR opens here.

**T2 — distribution integrity.** npm packages publish via OIDC trusted publishing (short-lived, repository-bound credentials; a stolen laptop yields no publish token) with sigstore provenance linking each package to the tagged commit and workflow run. Release tarballs are additionally attested with `actions/attest-build-provenance`, and consumers can verify with one command (`gh attestation verify … --repo debugmcp/mcp-debugger`). Residual: the Docker image and PyPI launcher are built by the same tag-triggered workflow but are not yet independently attested, and a first-ever npm publish uses a scoped token once (npm cannot attach a trusted publisher to a package that does not exist). Both gaps are documented rather than papered over.

**T3 — vulnerable dependencies.** `pnpm audit --prod --audit-level=high` is a hard gate in CI and in the release build job, backed by explicit `pnpm.overrides` forcing patched transitive versions. CodeQL runs on every push and PR; OpenSSF Scorecard runs weekly and on every push to main. SBOMs (SPDX + CycloneDX) ship with every release so downstream scanners can re-check continuously as new advisories land.

**T4 — capability abuse.** The [Trust Model](../SECURITY.md#trust-model) states the honest position: the MCP client inherits the privileges of the mcp-debugger process and of any debuggee it attaches to. Defense is therefore containment guidance (containers, OS permissions, loopback binding) plus harm reduction inside the tool: secret redaction on variable/evaluate/output responses by default, an opt-in least-privilege variable mode, per-session DAP mirror endpoints bound to loopback and gated by random tokens that are redacted from logs, and process isolation per session.

**T5 — continuity.** One person maintains this project; pretending otherwise would be false assurance. Continuity rests on organization-level controls instead: npm trusted publishing binds to the repository (not a personal account), the GitHub org owns the repo and secrets, and [MAINTAINERS.md](../MAINTAINERS.md) names the responsible entity (Sycamore LLC) with a monitored contact. Branch protection with required CI keeps a hijacked or hurried maintainer from bypassing the quality gate silently.

## Secure design principles applied

- **Economy of mechanism**: the server never executes user code itself; it delegates to the language's own debug adapter in a child process.
- **Fail-safe defaults**: secret redaction on by default; exception breakpoints default conservative; unpinned vendor downloads fail closed.
- **Complete mediation**: all published artifacts flow through one tag-triggered workflow; there is no manual publish path in normal operation.
- **Open design**: every control named here is inspectable in this repository; nothing relies on secrecy.
- **Least privilege**: workflow jobs carry minimal `permissions:` grants; the release workflow starts from `permissions: {}`.

## Residual risks, stated plainly

1. Docker/PyPI artifacts lack independent attestation (planned; tracked in the ops backlog).
2. First-publish npm packages use a scoped token once per package (transitional, self-eliminating).
3. A fully compromised GitHub organization owner account defeats most controls; 2FA enforcement and minimal-scope tokens reduce but do not eliminate this.
4. The SBOMs enumerate package-manager dependencies; embedded binaries are disclosed via the pin manifests instead of appearing as SBOM components.

We judge these acceptable because each is either transitional with a defined exit, or is the irreducible risk of any single-org open-source project — and all are disclosed here rather than implied away.

## Evidence

- [SUPPLY-CHAIN-SECURITY.md](../SUPPLY-CHAIN-SECURITY.md) — control specifications and verification commands
- [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/debugmcp/mcp-debugger) — automated, continuously refreshed assessment
- [OpenSSF Best Practices](https://www.bestpractices.dev/projects/13543) — self-assessment against community baseline
- Release assets — provenance bundles and SBOMs on every [GitHub release](https://github.com/debugmcp/mcp-debugger/releases)
