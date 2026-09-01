# Local CI/CD Testing with Act

## Overview

Act (https://github.com/nektos/act) allows you to run GitHub Actions locally, which is essential for:
- Debugging CI/CD failures without pushing commits
- Testing workflow changes before committing
- Replicating CI environment issues locally
- Faster iteration on CI/CD pipeline fixes

## Installation

Act must be installed on your system. The project helper script (`scripts/act-test.sh`) relies on an external `act` CLI being available without pinning a specific version.

```bash
# Check installed version
act --version

# Example installation (see Act docs for latest methods)
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
sudo mv ./bin/act /usr/local/bin/
```

## Configuration

The project includes an `.actrc` configuration file that sets up:
- Docker images that match GitHub Actions runners
- Container settings (privileged mode, memory allocation)
- Default workflow and platform mappings
- Bind mounts for Docker-in-Docker operations

## Usage

### Quick Commands

```bash
# List all available jobs
act -l

# Run the lint job (fastest for testing)
act -j lint

# Run build-and-test for Ubuntu only
act -j build-and-test --matrix os:ubuntu-latest

# Run all CI jobs
act

# Dry run (see what would happen without executing)
act -j lint --dryrun

# Verbose output for debugging
act -j build-and-test --verbose
```

### Using the Project Scripts

The `act:*` package scripts wrap `act` in `scripts\act-runner.cmd`, which checks that
Docker is running and that you can pull images before handing your arguments to `act`.
That wrapper is a `.cmd` file, so these scripts are **Windows-only** — on Linux/macOS run
`act` directly with the equivalent flags shown above.

```bash
# Check Act is installed
npm run act:check

# Run specific workflows
npm run act:lint        # Run lint job only
npm run act:test        # Run tests (Ubuntu)
npm run act:test:all    # Run tests (all platforms)
npm run act:full        # Run complete CI workflow
npm run act:list        # List jobs

# Debug mode
npm run act:debug       # Verbose output
```

There are also two thin task runners that pick a job for you — `ci` (build-and-test on
Ubuntu) or `release` (the release workflow's build-and-test). They accept a third argument,
`e2e`, but it is not a third choice: it runs the same `act -j build-and-test --matrix
os:ubuntu-latest` as `ci` with an extra `-e '{"test_filter":"e2e"}'` event payload, and no
workflow reads `test_filter` — so it never runs the e2e tests. For those, use the
`container-tests` job (see [Container Tests](#container-tests) below).

```bash
# Windows (use cmd, not PowerShell)
scripts\act-test.cmd ci

# Linux/macOS/WSL2
./scripts/act-test.sh ci
```

### Running Act from WSL2 on Windows

Act needs a Linux Docker daemon, so on Windows run it from inside WSL2:

- Docker Desktop's WSL2 integration must be enabled for your distro.
- Work from a copy of the tree inside the WSL2 filesystem rather than across `/mnt/c`.
  `scripts\sync-to-wsl.cmd` (a wrapper that runs `scripts/sync-to-wsl.sh` inside WSL)
  copies the project over for you.

### Skipping Act Entirely

Act reproduces the *workflow*; if you only need the *tests*, run them directly — but pick
the right command. `pnpm test` is **not** container-free: it expands to
`pnpm run build && pnpm run pretest:docker && vitest run`, where `pretest:docker`
(`scripts/docker-build-if-needed.js`) builds or refreshes the `mcp-debugger:local` image and
exits 1 if the Docker CLI is installed but the daemon is not running, and a bare
`vitest run` includes the `e2e` project — Docker end-to-end tests (`tests/e2e/docker/`)
among them.

The container-free commands are:

```bash
pnpm run test:unit       # the `unit` Vitest project alone — fastest
pnpm run test:no-docker  # whole suite with SKIP_DOCKER_TESTS=true, so pretest:docker
                         # returns early and the Docker suites skip themselves
```

### Platform-Specific Testing

```bash
# Test Ubuntu build
act -j build-and-test --matrix os:ubuntu-latest

# Test Windows build (uses Linux container that simulates Windows)
act -j build-and-test --matrix os:windows-latest

# Test specific Node version
act -j build-and-test --matrix os:ubuntu-latest --matrix node-version:22.x
```

## Common Issues and Solutions

### 1. Docker Permission Issues
```bash
# If you get docker permission errors:
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Container Architecture Issues
The `.actrc` file specifies `--container-architecture linux/amd64` for consistency, especially important on Apple Silicon Macs.

### 3. Memory Issues
If tests fail due to memory:
```bash
# Run with more memory
act -j build-and-test --container-options "--memory=8g"
```

### 4. Cache Issues
```bash
# Clean up Act cache
docker system prune -a
rm -rf ~/.cache/act
```

### 5. Network Issues
Act uses `--network="host"` by default. If you have network issues:
```bash
# Run with bridge network
act -j lint --network bridge
```

## Differences from GitHub Actions

1. **Secrets**: Act doesn't have access to GitHub secrets by default
   ```bash
   # Pass secrets manually
   act -s CODECOV_TOKEN="your-token"
   ```

2. **Artifacts**: Upload/download artifact actions are mocked locally

3. **Runner OS**: Act uses Linux containers even for Windows jobs

4. **Performance**: Local runs may be slower due to:
   - Docker overhead
   - No caching between runs (unless using `--reuse`)
   - Single machine vs GitHub's infrastructure

## Debugging CI/CD Failures

When CI fails on GitHub but works locally:

1. **Check the exact error**:
   ```bash
   # Run with verbose to see detailed output
   act -j build-and-test --verbose
   ```

2. **Match the matrix configuration**:
   ```bash
   # Run exact same matrix as failed CI
   act -j build-and-test --matrix os:ubuntu-latest --matrix node-version:22.x --matrix python-version:3.11
   ```

3. **Narrow to one job**: CI has five jobs — `build-and-test`, `windows-python-integration`,
   `lint`, `container-tests`, and `test-summary`. The last one is the aggregate gate: it
   `needs` the other four and fails when any of them did, so a red "Test Summary" check is
   pointing at one of the others rather than at work of its own. Run only the job that
   actually failed:
   ```bash
   act -j lint
   ```

## Container Management

```bash
# List Act containers
docker ps -a | grep act

# Clean up Act containers
docker container prune

# Remove Act images
docker images | grep catthehacker
docker rmi catthehacker/ubuntu:act-latest
```

## Advanced Usage

### Custom Workflows
```bash
# Run a specific workflow file
act -W .github/workflows/release.yml

# Run workflow with specific event
act push -W .github/workflows/ci.yml

# Trigger pull_request event
act pull_request
```

### Using Local Changes
By default, Act uses your current working directory. Changes are reflected immediately:
```bash
# Edit code, then run Act - no commit needed
vim src/server.ts
act -j build-and-test
```

## Performance Tips

1. **Use `--reuse` flag** to keep containers between runs:
   ```bash
   act -j lint --reuse
   ```

2. **Pull images beforehand**:
   ```bash
   docker pull catthehacker/ubuntu:act-latest
   ```

3. **Run specific jobs** instead of full workflow:
   ```bash
   act -j lint  # Faster than running all jobs
   ```

4. **Use smaller images** for simple jobs:
   ```bash
   act -j lint -P ubuntu-latest=node:22
   ```

## Project-Specific Notes

### Test Execution
The `build-and-test` job runs `pnpm run test:ci-coverage` — the `unit` and `integration`
Vitest projects with coverage. The `e2e` project is *not* part of it; the Docker
end-to-end tests run in the separate `container-tests` job. (The release workflow uses
`pnpm run test:ci-no-python`, which is the `unit` project alone.)

To make Python available to the job's container:
```bash
# Ensure Python and debugpy are available in container
act -j build-and-test --container-options "-e PYTHONPATH=/usr/local/lib/python3.11/site-packages"
```

### Container Tests
The `container-tests` job needs a working Docker daemon inside the runner: it builds the
image itself (`docker build -t mcp-debugger:local .`), and `pnpm run test:e2e:container`
then rebuilds it with `--no-cache` before running `tests/e2e/docker/`. `.actrc` already
passes `--privileged` for this:
```bash
act -j container-tests
```

Building the image is the slow part of that job. Running Vitest directly skips Act's
overhead, but note it does not skip every rebuild:
```bash
pnpm run docker-build            # tags mcp-debugger:local
pnpm vitest run tests/e2e/docker/
```
Most of those tests reuse `mcp-debugger:local` (`DEFAULT_IMAGE` in `docker-test-utils.ts`), so
the prebuild helps them. The two C/C++ tests do not: `docker-smoke-cpp.test.ts` and
`docker-smoke-cpp-attach.test.ts` each call `buildDockerImage({ imageName: 'mcp-debugger:test' })`
in their own `beforeAll`, so they rebuild under a second tag regardless. Narrow the run to the
files you care about if that matters.

### Tests That Behave Differently Under Act

A few tests are gated rather than universally green, and the gating is easy to mistake for
a failure when you are reading Act output. Two mechanisms are in play:

- **`describe.skipIf(SKIP_DOCKER_TESTS)`** — skips a whole suite at the Vitest level when
  `SKIP_DOCKER_TESTS=true`. Used by the Docker smoke tests
  (`tests/e2e/docker/docker-smoke-*.test.ts`).
- **Runtime platform checks** — an individual test returns early inside its own body when
  the platform does not match, so it is *reported as passing*. For example
  `tests/adapters/python/integration/python-discovery.test.ts` → "should find Python on
  Windows without explicit path" begins with `if (process.platform !== 'win32') { return; }`,
  and Act's Linux container always takes that branch. The Windows assertions run on the
  `windows-python-integration` CI job, never under Act.

The Docker smoke tests are also the most likely thing to *time out* under Act: they carry
generous per-test timeouts (240s for setup, 120s and 60s for the operations) that assume a
normal Docker daemon, and Act's nested-container setup with its volume mounts is slower
than the real runner. Timeouts and volume-mount failures there are usually an Act
limitation, not a product bug — confirm against real Docker (`pnpm run test:e2e:container`)
before chasing them.

### Coverage Reports
Coverage artifacts are uploaded but not actually saved locally. To preserve coverage:
```bash
# Copy coverage from container
container_id=$(docker ps -q --filter "name=act")
docker cp $container_id:/workspace/coverage ./coverage-from-act
```

## Troubleshooting Checklist

- [ ] Act installed and accessible: `act --version`
- [ ] Docker running: `docker ps`
- [ ] User in docker group: `groups | grep docker`
- [ ] Sufficient disk space: `df -h`
- [ ] Network connectivity: `docker pull catthehacker/ubuntu:act-latest`
- [ ] Clean workspace: `git status` (no uncommitted changes affecting tests)
- [ ] Dependencies installed: `pnpm install --frozen-lockfile`
- [ ] Project builds: `pnpm build`

## Further Resources

- Act Documentation: https://github.com/nektos/act
- Act Runner Images: https://github.com/catthehacker/docker_images
- GitHub Actions Documentation: https://docs.github.com/en/actions
- Project CI Configuration: `.github/workflows/ci.yml`