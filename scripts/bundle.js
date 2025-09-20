#!/usr/bin/env node
/**
 * Bundle the MCP debugger server into a single file using esbuild
 */

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

async function bundle() {
  console.log('Bundling MCP debugger server...');
  
  try {
    // Bundle the main application
    const result = await esbuild.build({
      entryPoints: ['dist/index.js'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: 'dist/bundle.cjs',
      define: {
        'import.meta.url': JSON.stringify('file:///app/dist/bundle.cjs'),
        '__dirname': JSON.stringify('/app/dist')
      },
      external: [
        // Keep native modules external
        'fsevents'
      ],
      minify: true,
      sourcemap: false,
      metafile: true,
      logLevel: 'info'
    });

    // Write metafile for analysis
    fs.writeFileSync('dist/bundle-meta.json', JSON.stringify(result.metafile));
    
    // CRITICAL: Add console silencing at the very beginning of the bundle
    let bundleContent = fs.readFileSync('dist/bundle.cjs', 'utf8');
    
    // Remove any shebang lines that got bundled (they're invalid in the middle of the file)
    bundleContent = bundleContent.replace(/^#!.*$/gm, '// shebang removed');
    
    const consoleSilencer = `#!/usr/bin/env node
// CRITICAL: Console silencing MUST be first - before ANY code runs
// This prevents stdout pollution in stdio mode which breaks MCP protocol
(function() {
  // Handle both quoted and unquoted stdio arguments
  const hasStdio = process.argv.some(arg => 
    arg === 'stdio' || 
    arg === '"stdio"' || 
    arg.includes('stdio')
  );
  
  if (hasStdio || process.env.DEBUG_MCP_STDIO === '1') {
    const noop = () => {};
    console.log = noop;
    console.error = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.trace = noop;
    console.dir = noop;
    console.table = noop;
    console.group = noop;
    console.groupEnd = noop;
    console.time = noop;
    console.timeEnd = noop;
    console.assert = noop;
    
    // Suppress process warnings
    process.removeAllListeners('warning');
    process.on('warning', noop);
  }
})();

// Clean argv before any code processes it - strip quotes from all arguments
process.argv = process.argv.map(arg => 
  typeof arg === 'string' ? arg.replace(/^["'](.*)["']$/, '$1') : arg
);

`;
    
    // Write the modified bundle with console silencing at the top
    fs.writeFileSync('dist/bundle.cjs', consoleSilencer + bundleContent);
    
    // Copy proxy-bootstrap.js to dist if it exists
    const proxyBootstrapSrc = path.join('src', 'proxy', 'proxy-bootstrap.js');
    const proxyBootstrapDest = path.join('dist', 'proxy', 'proxy-bootstrap.js');
    
    if (fs.existsSync(proxyBootstrapSrc)) {
      const proxyDir = path.dirname(proxyBootstrapDest);
      if (!fs.existsSync(proxyDir)) {
        fs.mkdirSync(proxyDir, { recursive: true });
      }
      fs.copyFileSync(proxyBootstrapSrc, proxyBootstrapDest);
      console.log('Copied proxy-bootstrap.js');
    }

    // Calculate bundle size
    const stats = fs.statSync('dist/bundle.cjs');
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`Bundle created successfully: ${sizeInMB} MB`);
    
    // Show what's included
    const text = await esbuild.analyzeMetafile(result.metafile, {
      verbose: false
    });
    console.log('\nBundle analysis:');
    console.log(text);
    
    // Create proxy bundle
    console.log('\nCreating proxy bundle...');
    const proxyResult = await esbuild.build({
      entryPoints: ['dist/proxy/dap-proxy-entry.js'],
      bundle: true,
      platform: 'node',
      outfile: 'dist/proxy/proxy-bundle.cjs',
      format: 'cjs',
      target: 'node20',
      define: {
        'import.meta.url': JSON.stringify('file:///app/dist/proxy/proxy-bundle.cjs'),
        '__dirname': JSON.stringify('/app/dist/proxy')
      },
      external: [], // Bundle ALL dependencies - don't exclude anything
      minify: false, // Keep readable for debugging
      sourcemap: 'inline',
      metafile: true,
      logLevel: 'info',
      // Ensure we don't mangle any strings or identifiers
      keepNames: true,
      charset: 'utf8'
    });

    // Analyze proxy bundle
    if (proxyResult.metafile) {
      const proxyText = await esbuild.analyzeMetafile(proxyResult.metafile);
      console.log('\nProxy bundle analysis:');
      console.log(proxyText);
    }
    
    // Verify proxy bundle was created and check size
    if (fs.existsSync('dist/proxy/proxy-bundle.cjs')) {
      const proxyStats = fs.statSync('dist/proxy/proxy-bundle.cjs');
      const proxySizeKB = (proxyStats.size / 1024).toFixed(2);
      console.log(`\nProxy bundle created successfully: ${proxySizeKB} KB`);
    } else {
      console.error('Proxy bundle was not created!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Bundle failed:', error);
    process.exit(1);
  }
}

bundle();
