#!/usr/bin/env node
/**
 * Test script to verify all adapters are bundled correctly
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Test loading the bundled CLI
const bundlePath = path.join(__dirname, 'package', 'dist', 'cli.mjs');

console.log('Testing bundled package...');
console.log('Bundle path:', bundlePath);

(async () => {
  try {
    // Attempt to import the bundle to ensure it executes without syntax errors
    await import(pathToFileURL(bundlePath).href);
    console.log('✅ Bundle imported successfully');

    // Check for adapter patterns in the bundle
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    const adapters = [
      { name: 'Mock', pattern: /MockAdapterFactory/i },
      { name: 'Python', pattern: /PythonAdapterFactory/i },
      { name: 'JavaScript', pattern: /JavascriptAdapterFactory/i }
    ];

    console.log('\nChecking for adapters in bundle:');
    adapters.forEach(adapter => {
      if (bundleContent.match(adapter.pattern)) {
        console.log(`✅ ${adapter.name} adapter found`);
      } else {
        console.log(`❌ ${adapter.name} adapter NOT found`);
      }
    });

    // Check that required runtime assets were copied into the bundle
    console.log('\nChecking for required runtime assets:');
    const requiredAssets = [
      {
        name: 'netcoredbg bridge (.NET)',
        path: 'packages/adapter-dotnet/dist/utils/netcoredbg-bridge.js'
      },
      {
        name: 'proxy bundle',
        path: 'proxy/proxy-bundle.cjs'
      }
    ];
    const optionalAssets = [
      {
        name: 'js-debug vendor (JavaScript)',
        path: 'vendor/js-debug/vsDebugServer.cjs'
      },
      {
        name: 'CodeLLDB vendor (Rust)',
        path: 'vendor/codelldb'
      }
    ];

    let assetsMissing = false;
    for (const asset of requiredAssets) {
      const assetPath = path.join(__dirname, 'dist', asset.path);
      if (fs.existsSync(assetPath)) {
        console.log(`  ✅ ${asset.name}: ${asset.path}`);
      } else {
        console.log(`  ❌ ${asset.name}: ${asset.path} MISSING`);
        assetsMissing = true;
      }
    }
    for (const asset of optionalAssets) {
      const assetPath = path.join(__dirname, 'dist', asset.path);
      if (fs.existsSync(assetPath)) {
        console.log(`  ✅ ${asset.name}: ${asset.path}`);
      } else {
        console.log(`  ⚠️  ${asset.name}: ${asset.path} (optional, not found)`);
      }
    }

    if (assetsMissing) {
      console.error('\n❌ Required runtime assets missing from bundle!');
      process.exit(1);
    }

    // Check bundle size
    const stats = fs.statSync(bundlePath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`\n📦 Bundle size: ${sizeInMB} MB`);

    console.log('\n✅ All tests passed! The bundle is ready for npx distribution.');
  } catch (error) {
    console.error('❌ Error testing bundle:', error.message);
    process.exit(1);
  }
})();
