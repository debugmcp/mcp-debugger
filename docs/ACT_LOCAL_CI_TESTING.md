# Local CI/CD Testing with Act

## Overview

Act (https://github.com/nektos/act) allows you to run GitHub Actions locally, which is essential for:
- Debugging CI/CD failures without pushing commits
- Testing workflow changes before committing
- Replicating CI environment issues locally
- Faster iteration on CI/CD pipeline fixes

## Installation

Act has been installed on this system:
```bash
# Version installed
act --version  # 0.2.81

# Installation method used
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

### Using NPM Scripts

The project provides convenience scripts:

```bash
# Check Act is installed
npm run act:check

# Run specific workflows
npm run act:lint        # Run lint job only
npm run act:test        # Run tests (Ubuntu)
npm run act:test:all    # Run tests (all platforms)
npm run act:full        # Run complete CI workflow

# Debug mode
npm run act:debug       # Verbose output
```

### Platform-Specific Testing

```bash
# Test Ubuntu build
act -j build-and-test --matrix os:ubuntu-latest

# Test Windows build (uses Linux container that simulates Windows)
act -j build-and-test --matrix os:windows-latest

# Test specific Node version
act -j build-and-test --matrix os:ubuntu-latest --matrix node-version:20.x
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
   act -j build-and-test --matrix os:ubuntu-latest --matrix node-version:20.x --matrix python-version:3.11
   ```

3. **Check environment differences**:
   ```bash
   # See what environment variables are set
   act -j build-and-test --env-file .env.ci
   ```

4. **Test in isolation**:
   ```bash
   # Run just the failing step
   act -j build-and-test --job build-and-test --rerun
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

### Debugging Inside Container
```bash
# Start interactive shell in Act container
act -j lint --container-options "-it" --exec sh

# Or use bash if available
act -j lint --container-options "-it" --exec bash
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
   act -j lint -P ubuntu-latest=node:20
   ```

## Project-Specific Notes

### Test Execution
The CI runs `npm run test:ci-no-python` which excludes Python integration tests. To test with Python:
```bash
# Ensure Python and debugpy are available in container
act -j build-and-test --container-options "-e PYTHONPATH=/usr/local/lib/python3.11/site-packages"
```

### Container Tests
The `container-tests` job requires Docker-in-Docker:
```bash
# Already configured in .actrc with --privileged flag
act -j container-tests
```

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
- [ ] Dependencies installed: `npm ci`
- [ ] Project builds: `npm run build`

## Further Resources

- Act Documentation: https://github.com/nektos/act
- Act Runner Images: https://github.com/catthehacker/docker_images
- GitHub Actions Documentation: https://docs.github.com/en/actions
- Project CI Configuration: `.github/workflows/ci.yml`