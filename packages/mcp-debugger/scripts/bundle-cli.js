#!/usr/bin/env node
/**
 * Bundle the MCP debugger CLI for npx distribution
 */

import * as esbuild from 'esbuild';
import fs from 'fs';

async function bundleCLI() {
  console.log('Bundling MCP debugger CLI...');
  
  try {
    const distDir = 'dist';
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });

    // Bundle the CLI entry point directly from TypeScript source
    const result = await esbuild.build({
      entryPoints: ['src/cli-entry.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: 'dist/cli.mjs',
      banner: {
        js: [
          'import { createRequire as __createRequire } from "module";',
          'const require = __createRequire(import.meta.url);'
        ].join('\n')
      },
      external: [
        // Keep only native modules external
        // Adapters are now bundled for "batteries included" npx distribution
        'fsevents'
      ],
      minify: false, // Keep readable for debugging
      sourcemap: false,
      metafile: true,
      logLevel: 'info',
      loader: {
        '.ts': 'ts',
        '.js': 'js'
      }
    });

    // Write metafile for analysis
    fs.writeFileSync('dist/bundle-meta.json', JSON.stringify(result.metafile));
    
    // Make the bundle executable
    const bundlePath = 'dist/cli.mjs';
    if (fs.existsSync(bundlePath)) {
      // Add shebang if not present
      let bundleContent = fs.readFileSync(bundlePath, 'utf8');
      if (!bundleContent.startsWith('#!/usr/bin/env node')) {
        bundleContent = '#!/usr/bin/env node\n' + bundleContent;
        fs.writeFileSync(bundlePath, bundleContent);
      }
      
      // Make executable on Unix-like systems
      if (process.platform !== 'win32') {
        fs.chmodSync(bundlePath, '755');
      }
    }

    // Calculate bundle size
    const stats = fs.statSync(bundlePath);
    const sizeInKB = (stats.size / 1024).toFixed(2);
    console.log(`CLI bundle created successfully: ${sizeInKB} KB`);
    
    // Show what's included
    const text = await esbuild.analyzeMetafile(result.metafile, {
      verbose: false
    });
    console.log('\nBundle analysis:');
    console.log(text);
    
  } catch (error) {
    console.error('Bundle failed:', error);
    process.exit(1);
  }
}

bundleCLI();
