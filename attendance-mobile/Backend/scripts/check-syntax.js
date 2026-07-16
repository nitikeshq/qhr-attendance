const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

for (const file of [...walk(path.join(process.cwd(), 'src')), ...walk(path.join(process.cwd(), 'scripts'))]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log('Syntax check passed.');
