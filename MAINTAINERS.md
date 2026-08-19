# Maintainers

mcp-debugger is maintained by [Sycamore LLC](mailto:admin@debugmcp.io).

| Name | GitHub | Affiliation | Role |
|---|---|---|---|
| John Franklin | [@debugmcpdev](https://github.com/debugmcpdev) | Sycamore LLC | Lead maintainer, release authority |

## Responsibilities

Maintainers review and merge pull requests, cut releases, hold publishing access for the distribution channels below, and triage security reports per [SECURITY.md](SECURITY.md).

| Channel | Identity |
|---|---|
| npm | [`@debugmcp` scope](https://www.npmjs.com/org/debugmcp) (OIDC trusted publishing; a scoped token is used only for a package's first-ever publish) |
| Docker Hub | [`debugmcp` org](https://hub.docker.com/r/debugmcp/mcp-debugger) |
| PyPI | [`debug-mcp-server-launcher`](https://pypi.org/project/debug-mcp-server-launcher/) |
| GitHub | [`debugmcp` org](https://github.com/debugmcp) |

## Continuity

Publishing is tied to the GitHub repository via OIDC where supported, not to individual accounts; organization-level GitHub access provides continuity if any individual maintainer becomes unavailable. See [SUPPLY-CHAIN-SECURITY.md](SUPPLY-CHAIN-SECURITY.md#access-continuity) for the full access-continuity table.

## Becoming a maintainer

Sustained, high-quality contributions (code, adapters, triage) are the path. Open an issue or email admin@debugmcp.io if you're interested in taking on a language adapter or subsystem.
