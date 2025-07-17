/**
 * Conditionally build Docker image if needed for tests
 */
import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

const IMAGE_NAME = 'mcp-debugger:local';

// Skip if Docker tests are disabled
if (process.env.SKIP_DOCKER_TESTS === 'true') {
  console.log('[Docker Build] Skipping - SKIP_DOCKER_TESTS is set');
  process.exit(0);
}

// Check if Docker is available
try {
  execSync('docker --version', { stdio: 'ignore' });
} catch {
  console.log('[Docker Build] Docker not available - skipping build');
  process.exit(0);
}

// Check if image exists and get its age
let imageExists = false;
let imageBuildTime = null;

try {
  const output = execSync(`docker inspect ${IMAGE_NAME} --format="{{.Created}}"`, { 
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore']
  });
  imageExists = true;
  imageBuildTime = new Date(output.trim());
} catch {
  imageExists = false;
}

// Get the last modified time of key files
import { readdirSync } from 'fs';

function getLatestModifiedTime(dir, newestTime = new Date(0)) {
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      // Recursively check subdirectories
      newestTime = getLatestModifiedTime(fullPath, newestTime);
    } else if (entry.isFile()) {
      const stats = statSync(fullPath);
      if (stats.mtime > newestTime) {
        newestTime = stats.mtime;
      }
    }
  }
  
  return newestTime;
}

// Check specific files and all source directories
const filesToCheck = [
  'Dockerfile',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'scripts/bundle.js'
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

// Determine if we need to build
let needsBuild = false;
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

// Build if needed
if (needsBuild) {
  try {
    // Remove the old image first to force rebuild (keeps base images cached)
    if (imageExists) {
      console.log(`[Docker Build] Removing old ${IMAGE_NAME} image...`);
      try {
        execSync(`docker rmi ${IMAGE_NAME}`, { stdio: 'inherit' });
      } catch {
        console.warn('[Docker Build] Warning: Could not remove old image');
      }
    }
    
    console.log(`[Docker Build] Building ${IMAGE_NAME}...`);
    // Add timestamp as build arg to force cache invalidation for our layers
    const timestamp = Date.now();
    execSync(`docker build . -t ${IMAGE_NAME} --build-arg CACHEBUST=${timestamp}`, { 
      stdio: 'inherit',
      env: { ...process.env, DOCKER_BUILDKIT: '1' }
    });
    console.log('[Docker Build] Build completed successfully');
    
    // Verify the image was created
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
