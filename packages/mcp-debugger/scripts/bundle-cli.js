#!/usr/bin/env node
/**
 * Bundle the MCP debugger CLI for npx distribution using tsup.
 */

import { build } from 'tsup';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bundleProxy() {
  console.log('Bundling proxy with tsup...');
  
  const rootDir = path.resolve(__dirname, '../../..');
  
  // Build the proxy bundle
  await build({
    entry: {
      'proxy-bundle': path.join(rootDir, 'dist/proxy/dap-proxy-entry.js')
    },
    format: ['cjs'], // Proxy expects CommonJS
    platform: 'node',
    target: 'node18',
    splitting: false,
    sourcemap: false,
    clean: false, // Don't clean, we're building into existing dist
    outDir: 'dist/proxy',
    shims: true,
    noExternal: [/./], // Bundle all dependencies
    cwd: path.resolve('packages/mcp-debugger'),
    skipNodeModulesBundle: false,
    silent: true,
    onSuccess: async () => {
      console.log('✓ Proxy bundle created');
    }
  });
}

async function bundleCLI() {
  console.log('Bundling MCP debugger CLI with tsup...');

  try {
    console.log(`Working directory: ${process.cwd()}`);

    const distDir = path.resolve('dist');
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
      cwd: path.resolve('packages/mcp-debugger'),
      banner: {
        js: [
          'import { createRequire as __createRequire } from "module";',
          'const require = __createRequire(import.meta.url);'
        ].join('\n')
      },
      outExtension() {
        return {
          js: '.mjs'
        };
      }
    });

    const bundlePath = path.resolve('dist/cli.mjs');

    const wrapperPath = path.resolve('dist/cli');
    const wrapperContent = [
      '#!/usr/bin/env node',
      "import('./cli.mjs').catch((error) => {",
      "  console.error('Fatal error:', error);",
      "  process.exit(1);",
      '});',
      ''
    ].join('\n');
    fs.writeFileSync(wrapperPath, wrapperContent);
    if (process.platform !== 'win32') {
      fs.chmodSync(wrapperPath, 0o755);
    }

    const sizeInKB = (fs.statSync(bundlePath).size / 1024).toFixed(2);
    console.log(`CLI bundle created successfully: ${sizeInKB} KB`);

    // Copy static assets needed at runtime
    console.log('\nCopying static assets...');
    
    const rootDir = path.resolve(__dirname, '../../..');
    const rootDistDir = path.join(rootDir, 'dist');
    
    // Copy all necessary directories from root dist that the proxy needs
    const dirsToCopy = ['proxy', 'errors', 'adapters', 'session', 'utils'];
    
    for (const dir of dirsToCopy) {
      const srcDir = path.join(rootDistDir, dir);
      if (fs.existsSync(srcDir)) {
        const destDir = path.join(distDir, dir);
        fs.cpSync(srcDir, destDir, { 
          recursive: true,
          filter: (src) => {
            // Copy .js files, skip .ts and .map files
            const stat = fs.statSync(src);
            if (stat.isDirectory()) return true;
            return src.endsWith('.js') && !src.endsWith('.d.ts');
          }
        });
        console.log(`✓ Copied ${dir} directory`);
      }
    }
    
    // Bundle the proxy after copying files
    console.log('\nBundling proxy...');
    await bundleProxy();
    
    // Copy js-debug adapter
    const jsDebugSrc = path.join(rootDir, 'packages/adapter-javascript/vendor/js-debug');
    if (fs.existsSync(jsDebugSrc)) {
      const jsDebugDistDest = path.join(distDir, 'vendor/js-debug');
      fs.cpSync(jsDebugSrc, jsDebugDistDest, { recursive: true });
      console.log('✓ Copied js-debug adapter');
    } else {
      console.warn('⚠ js-debug adapter not found - JavaScript debugging may not work');
      console.warn('  Run: pnpm -w -F @debugmcp/adapter-javascript run build:adapter');
    }
    
    console.log('\n✅ Bundle complete!');
  } catch (error) {
    console.error('Bundle failed:', error);
    process.exit(1);
  }
}

bundleCLI();
