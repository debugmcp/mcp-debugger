#!/usr/bin/env node
/**
 * Bundle the MCP debugger CLI and proxy assets for distribution.
 *
 * This script produces three artifacts:
 *  - packages/mcp-debugger/dist/**               (runtime bundle used by the CLI)
 *  - packages/mcp-debugger/package/dist/**       (mirrors the bundle for npm pack)
 *  - packages/mcp-debugger/package/debugmcp-*.tgz (fresh npm pack tarball)
 * It also regenerates dist/proxy/proxy-bundle.cjs for SSE/stdio transports.
 */

import { build } from 'tsup';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

async function bundleProxy() {
  console.log('Bundling proxy with tsup...');

  await build({
    entry: {
      'proxy-bundle': path.join(repoRoot, 'dist/proxy/dap-proxy-entry.js')
    },
    format: ['cjs'],
    platform: 'node',
    target: 'node18',
    splitting: false,
    sourcemap: false,
    clean: false,
    outDir: 'dist/proxy',
    shims: true,
    noExternal: [/./],
    cwd: packageRoot,
    skipNodeModulesBundle: false,
    silent: true
  });

  console.log('Proxy bundle refreshed at packages/mcp-debugger/dist/proxy/proxy-bundle.cjs');
}

async function bundleCLI() {
  console.log('Bundling MCP debugger CLI with tsup...');
  console.log(`Working directory: ${process.cwd()}`);

  const distDir = path.join(packageRoot, 'dist');
  fs.rmSync(distDir, { recursive: true, force: true });

  await build({
    entry: {
      cli: 'src/cli-entry.ts'
    },
    format: ['esm'],
    platform: 'node',
    target: 'node18',
    splitting: false,
    sourcemap: false,
    clean: true,
    outDir: 'dist',
    shims: false,
    noExternal: [/./],
    cwd: packageRoot,
    banner: {
      js: [
        'import { createRequire as __createRequire } from "module";',
        'const require = __createRequire(import.meta.url);'
      ].join('\n')
    },
    outExtension() {
      return { js: '.mjs' };
    }
  });

  const bundlePath = path.join(distDir, 'cli.mjs');
  const wrapperPath = path.join(distDir, 'cli');
  const wrapperContent = [
    '#!/usr/bin/env node',
    "import('./cli.mjs').catch((error) => {",
    "  console.error('Fatal error:', error);",
    '  process.exit(1);',
    '});',
    ''
  ].join('\n');

  fs.writeFileSync(wrapperPath, wrapperContent);
  if (process.platform !== 'win32') {
    fs.chmodSync(wrapperPath, 0o755);
  }

  const sizeInKB = (fs.statSync(bundlePath).size / 1024).toFixed(2);
  console.log(`CLI bundle created successfully (${sizeInKB} KB).`);

  console.log('\nCopying runtime assets...');
  const rootDistDir = path.join(repoRoot, 'dist');
  const dirsToCopy = ['proxy', 'errors', 'adapters', 'session', 'utils'];

  for (const dir of dirsToCopy) {
    const srcDir = path.join(rootDistDir, dir);
    if (!fs.existsSync(srcDir)) {
      continue;
    }

    const destDir = path.join(distDir, dir);
    fs.cpSync(srcDir, destDir, {
      recursive: true,
      filter: (src) => {
        const stat = fs.statSync(src);
        if (stat.isDirectory()) return true;
        return src.endsWith('.js') && !src.endsWith('.d.ts');
      }
    });
    console.log(`Copied ${dir}/ from repo dist.`);
  }

  console.log('\nBundling proxy from fresh dist...');
  await bundleProxy();

  const jsDebugSrc = path.join(repoRoot, 'packages/adapter-javascript/vendor/js-debug');
  if (fs.existsSync(jsDebugSrc)) {
    const jsDebugDest = path.join(distDir, 'vendor/js-debug');
    // Remove destination if it exists to avoid permission issues
    if (fs.existsSync(jsDebugDest)) {
      try {
        execSync(`rm -rf "${jsDebugDest}"`, { stdio: 'pipe' });
      } catch (err) {
        console.warn('Failed to remove existing vendor directory:', err.message);
      }
    }
    // Use shell cp command which handles permission issues better than fs.cpSync
    try {
      fs.mkdirSync(path.join(distDir, 'vendor'), { recursive: true });
      execSync(`cp -r "${jsDebugSrc}" "${jsDebugDest}"`, { stdio: 'pipe' });
      console.log('Copied js-debug adapter payload.');
    } catch (err) {
      console.warn('Warning: Failed to copy js-debug vendor directory:', err.message);
      console.warn('JavaScript debugging may be impacted.');
    }
  } else {
    console.warn('Warning: js-debug adapter vendor directory not found; JavaScript debugging may fail.');
    console.warn('Run: pnpm -w -F @debugmcp/adapter-javascript run build:adapter');
  }

  const rustVendorSrc = path.join(repoRoot, 'packages/adapter-rust/vendor/codelldb');
  if (fs.existsSync(rustVendorSrc)) {
    const rawPlatforms = process.env.CODELLDB_PACKAGE_PLATFORMS ?? 'linux-x64';
    const requestedPlatforms = rawPlatforms
      .split(',')
      .map((platform) => platform.trim())
      .filter(Boolean);

    if (requestedPlatforms.length === 0) {
      console.log('Skipping CodeLLDB inclusion (CODELLDB_PACKAGE_PLATFORMS empty).');
    } else {
      const rustVendorDest = path.join(distDir, 'vendor/codelldb');
      fs.mkdirSync(rustVendorDest, { recursive: true });

      for (const platform of requestedPlatforms) {
        if (platform.toLowerCase() === 'none') {
          continue;
        }

        const srcDir = path.join(rustVendorSrc, platform);
        if (!fs.existsSync(srcDir)) {
          console.warn(`[CodeLLDB bundler] Requested platform "${platform}" not found in vendor directory.`);
          console.warn('Run: pnpm -w -F @debugmcp/adapter-rust run build:adapter');
          continue;
        }

        const destDir = path.join(rustVendorDest, platform);
        // Use shell cp command to avoid permission issues
        try {
          if (fs.existsSync(destDir)) {
            execSync(`rm -rf "${destDir}"`, { stdio: 'pipe' });
          }
          execSync(`cp -r "${srcDir}" "${destDir}"`, { stdio: 'pipe' });
          console.log(`Copied CodeLLDB payload for ${platform}.`);
        } catch (err) {
          console.warn(`Warning: Failed to copy CodeLLDB for ${platform}:`, err.message);
        }
      }
    }
  } else {
    console.warn('Warning: CodeLLDB vendor directory not found; Rust debugging may fail.');
    console.warn('Run: pnpm -w -F @debugmcp/adapter-rust run build:adapter');
  }

  // Mirror dist into the package/ directory used by npm pack artifacts.
  const packageDir = path.join(packageRoot, 'package');
  const packageDistDir = path.join(packageDir, 'dist');
  fs.mkdirSync(packageDir, { recursive: true });
  // Use shell commands to avoid permission issues
  try {
    execSync(`rm -rf "${packageDistDir}"`, { stdio: 'pipe' });
  } catch (err) {
    // Ignore error if directory doesn't exist
  }
  execSync(`cp -r "${distDir}" "${packageDistDir}"`, { stdio: 'pipe' });
  console.log('Copied bundle into packages/mcp-debugger/package/dist/.');

  console.log('\nGenerating npm pack tarball...');
  execSync('pnpm pack --pack-destination package', {
    cwd: packageRoot,
    stdio: 'inherit'
  });
  console.log('npm pack artifact refreshed in packages/mcp-debugger/package/.');

  console.log('\nBundle pipeline complete.');
}

try {
  await bundleCLI();
} catch (error) {
  console.error('Bundle failed:', error);
  process.exit(1);
}
