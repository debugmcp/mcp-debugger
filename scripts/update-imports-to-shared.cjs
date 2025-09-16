/**
 * Script to update imports from local paths to @debugmcp/shared package
 * Handles both TypeScript files and test files
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Mapping of old import paths to new package import
const importMappings = [
  // Direct file mappings
  { from: './adapters/debug-adapter-interface', to: '@debugmcp/shared' },
  { from: '../adapters/debug-adapter-interface', to: '@debugmcp/shared' },
  { from: '../../adapters/debug-adapter-interface', to: '@debugmcp/shared' },
  { from: '../../../adapters/debug-adapter-interface', to: '@debugmcp/shared' },
  { from: './src/adapters/debug-adapter-interface', to: '@debugmcp/shared' },
  { from: '../src/adapters/debug-adapter-interface', to: '@debugmcp/shared' },
  
  { from: './adapters/adapter-registry-interface', to: '@debugmcp/shared' },
  { from: '../adapters/adapter-registry-interface', to: '@debugmcp/shared' },
  { from: '../../adapters/adapter-registry-interface', to: '@debugmcp/shared' },
  { from: '../../../adapters/adapter-registry-interface', to: '@debugmcp/shared' },
  { from: './src/adapters/adapter-registry-interface', to: '@debugmcp/shared' },
  { from: '../src/adapters/adapter-registry-interface', to: '@debugmcp/shared' },
  
  { from: './session/models', to: '@debugmcp/shared' },
  { from: '../session/models', to: '@debugmcp/shared' },
  { from: '../../session/models', to: '@debugmcp/shared' },
  { from: '../../../session/models', to: '@debugmcp/shared' },
  { from: './src/session/models', to: '@debugmcp/shared' },
  { from: '../src/session/models', to: '@debugmcp/shared' },
  
  { from: './interfaces/external-dependencies', to: '@debugmcp/shared' },
  { from: '../interfaces/external-dependencies', to: '@debugmcp/shared' },
  { from: '../../interfaces/external-dependencies', to: '@debugmcp/shared' },
  { from: '../../../interfaces/external-dependencies', to: '@debugmcp/shared' },
  { from: './src/interfaces/external-dependencies', to: '@debugmcp/shared' },
  { from: '../src/interfaces/external-dependencies', to: '@debugmcp/shared' },
  
  { from: './interfaces/process-interfaces', to: '@debugmcp/shared' },
  { from: '../interfaces/process-interfaces', to: '@debugmcp/shared' },
  { from: '../../interfaces/process-interfaces', to: '@debugmcp/shared' },
  { from: '../../../interfaces/process-interfaces', to: '@debugmcp/shared' },
  { from: './src/interfaces/process-interfaces', to: '@debugmcp/shared' },
  { from: '../src/interfaces/process-interfaces', to: '@debugmcp/shared' },
];

// Files to process
const patterns = [
  'src/**/*.ts',
  'tests/**/*.ts',
  'tests/**/*.js'
];

let totalUpdates = 0;
let filesUpdated = 0;

patterns.forEach(pattern => {
  const files = glob.sync(pattern, {
    ignore: ['node_modules/**', 'dist/**', 'packages/**']
  });
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let updated = false;
    
    importMappings.forEach(mapping => {
      // Handle both .js and no extension
      const patterns = [
        new RegExp(`from ['"]${mapping.from}(\\.js)?['"]`, 'g'),
        new RegExp(`import\\(['"]${mapping.from}(\\.js)?['"]\\)`, 'g'),
        new RegExp(`require\\(['"]${mapping.from}(\\.js)?['"]\\)`, 'g')
      ];
      
      patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          content = content.replace(pattern, (match) => {
            totalUpdates++;
            const quote = match.includes('"') ? '"' : "'";
            
            if (match.startsWith('from')) {
              return `from ${quote}${mapping.to}${quote}`;
            } else if (match.includes('import(')) {
              return `import(${quote}${mapping.to}${quote})`;
            } else {
              return `require(${quote}${mapping.to}${quote})`;
            }
          });
          updated = true;
        }
      });
    });
    
    if (updated) {
      fs.writeFileSync(file, content);
      filesUpdated++;
      console.log(`Updated: ${file}`);
    }
  });
});

console.log(`\n✅ Import update complete!`);
console.log(`   Files updated: ${filesUpdated}`);
console.log(`   Total imports updated: ${totalUpdates}`);
