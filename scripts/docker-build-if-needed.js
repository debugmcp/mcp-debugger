/**
 * Conditionally build Docker image if needed for tests
 */
import { execSync } from 'child_process';
import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

const IMAGE_NAME = process.env.DOCKER_IMAGE_NAME || 'mcp-debugger:local';
const FORCE_REBUILD = process.env.DOCKER_FORCE_REBUILD === 'true';
const PACK_LOCK_PATH = join(process.cwd(), 'packages', 'mcp-debugger', '.pack-lock');
const PACKAGE_BACKUP_PATH = join(process.cwd(), 'packages', 'mcp-debugger', 'package.json.backup');
const PACK_LOCK_MAX_WAIT_MS = 5 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPackLockIfNeeded() {
  if (!existsSync(PACK_LOCK_PATH)) {
    return;
  }

  console.log('[Docker Build] Detected NPX packaging lock. Waiting for it to finish...');
  const start = Date.now();

  while (existsSync(PACK_LOCK_PATH)) {
    if (Date.now() - start > PACK_LOCK_MAX_WAIT_MS) {
      console.warn('[Docker Build] Pack lock wait timed out after 5 minutes. Continuing anyway.');
      break;
    }
    await sleep(1000);
  }
}

async function restorePackageManifestIfNeeded() {
  if (existsSync(PACKAGE_BACKUP_PATH)) {
    console.log('[Docker Build] Restoring package.json after interrupted pack operation...');
    try {
      execSync('node scripts/prepare-pack.js restore', { stdio: 'inherit' });
    } catch (error) {
      console.warn('[Docker Build] Warning: failed to restore package.json backup:', error);
    }
  }
}

// Runtime and build artifacts that .dockerignore excludes from the image
// (logs, dist, pack output, ...). Tests write logs under packages/ mid-run,
// so counting these mtimes would mark a just-built image as stale and force
// a needless (and destructive) rebuild between suites of the same run.
const SKIPPED_DIRS = new Set(['node_modules', 'logs', 'dist', 'package-cache', 'package', 'sessions', 'coverage']);
const SKIPPED_FILE_PATTERN = /\.(log|tsbuildinfo|tgz)$/;

function getLatestModifiedTime(dir, newestTime = new Date(0)) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('.') && !SKIPPED_DIRS.has(entry.name)) {
      newestTime = getLatestModifiedTime(fullPath, newestTime);
    } else if (entry.isFile() && !SKIPPED_FILE_PATTERN.test(entry.name)) {
      const stats = statSync(fullPath);
      if (stats.mtime > newestTime) {
        newestTime = stats.mtime;
      }
    }
  }

  return newestTime;
}

async function main() {
  if (!FORCE_REBUILD && process.env.SKIP_DOCKER_TESTS === 'true') {
    console.log('[Docker Build] Skipping - SKIP_DOCKER_TESTS is set');
    return;
  }

  try {
    execSync('docker --version', { stdio: 'ignore' });
    // Also verify that Docker can actually build (e.g., buildx is available)
    execSync('docker buildx version', { stdio: 'ignore' });
  } catch {
    console.log('[Docker Build] Docker CLI not installed - skipping build');
    return;
  }

  // Docker CLI exists — now verify the daemon is actually running
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch {
    console.error('[Docker Build] ERROR: Docker Desktop is not running. Please start Docker Desktop and try again.');
    process.exit(1);
  }

  await waitForPackLockIfNeeded();
  await restorePackageManifestIfNeeded();

  let imageExists = false;
  let imageBuildTime = null;

  try {
    // Prefer LastTagTime over Created: with BuildKit layer caching, a rebuild
    // that fully cache-hits produces an identical image whose Created is the
    // ORIGINAL build time, so comparing against Created marks the image as
    // outdated forever. LastTagTime advances on every successful build.
    const output = execSync(`docker inspect ${IMAGE_NAME} --format="{{.Created}}|{{json .Metadata.LastTagTime}}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    imageExists = true;
    const [created, lastTagJson] = output.trim().split('|');
    let buildTime = new Date(created);
    try {
      const lastTag = new Date(JSON.parse(lastTagJson));
      // Zero value ("0001-01-01...") means the tag time is unknown (e.g. pulled image)
      if (!isNaN(lastTag) && lastTag.getFullYear() > 1971 && lastTag > buildTime) {
        buildTime = lastTag;
      }
    } catch {
      // Malformed/missing LastTagTime — fall back to Created
    }
    imageBuildTime = buildTime;
  } catch {
    imageExists = false;
  }

  // Check specific files and all source directories
  const filesToCheck = [
    'Dockerfile',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'scripts/bundle.js',
    'vitest.workspace.ts',
    'packages/shared/package.json'
  ];

  let newestFileTime = new Date(0);

  // Check individual files
  for (const file of filesToCheck) {
    const filePath = join(process.cwd(), file);
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      if (stats.mtime > newestFileTime) {
        newestFileTime = stats.mtime;
      }
    }
  }

  // Check all source files
  const srcDir = join(process.cwd(), 'src');
  if (existsSync(srcDir)) {
    newestFileTime = getLatestModifiedTime(srcDir, newestFileTime);
  }

  // Check all script files
  const scriptsDir = join(process.cwd(), 'scripts');
  if (existsSync(scriptsDir)) {
    newestFileTime = getLatestModifiedTime(scriptsDir, newestFileTime);
  }

  const packagesDir = join(process.cwd(), 'packages');
  if (existsSync(packagesDir)) {
    newestFileTime = getLatestModifiedTime(packagesDir, newestFileTime);
  }

  let needsBuild = FORCE_REBUILD;
  if (!imageExists) {
    console.log('[Docker Build] Image does not exist - building...');
    needsBuild = true;
  } else if (imageBuildTime < newestFileTime) {
    console.log('[Docker Build] Image is outdated - rebuilding...');
    console.log(`  Image built: ${imageBuildTime.toISOString()}`);
    console.log(`  Newest file: ${newestFileTime.toISOString()}`);
    needsBuild = true;
  } else {
    console.log('[Docker Build] Image is up to date');
  }

  if (needsBuild) {
    try {
      // No pre-build `docker rmi`: a successful `docker build -t` retags
      // atomically (the old image just goes dangling), and a failed rebuild
      // must leave the previous working image in place for other suites.
      console.log(`[Docker Build] Building ${IMAGE_NAME}...`);
      const timestamp = Date.now();
      execSync(`docker build . -t ${IMAGE_NAME} --build-arg CACHEBUST=${timestamp}`, {
        stdio: 'inherit',
        env: { ...process.env, DOCKER_BUILDKIT: '1' }
      });
      console.log('[Docker Build] Build completed successfully');

      try {
        execSync(`docker inspect ${IMAGE_NAME}`, { stdio: 'ignore' });
        console.log('[Docker Build] Image verified successfully');
      } catch {
        console.error('[Docker Build] ERROR: Image was not created!');
        process.exit(1);
      }
    } catch (error) {
      console.error('[Docker Build] Build failed:', error);
      process.exit(1);
    }
  }
}

try {
  await main();
} catch (error) {
  console.error('[Docker Build] Unexpected error:', error);
  process.exit(1);
}
