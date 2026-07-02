const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const componentsDir = path.join(__dirname, 'src', 'components');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Backgrounds
  content = content.replace(/bg-white\/80/g, 'bg-black/60');
  content = content.replace(/bg-white\/50/g, 'bg-black/40');
  content = content.replace(/bg-white\/10/g, 'bg-white/5');
  content = content.replace(/bg-white\/5/g, 'bg-white/5');
  content = content.replace(/bg-white/g, 'bg-black/40');
  content = content.replace(/bg-gray-50/g, 'bg-white/10');
  
  // Text colors
  content = content.replace(/text-secondary-foreground/g, 'text-white/60');
  content = content.replace(/text-text/g, 'text-white');
  
  // Borders
  content = content.replace(/border-border/g, 'border-white/10');
  
  fs.writeFileSync(filePath, content, 'utf8');
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir(pagesDir);
walkDir(componentsDir);
console.log('Theme replaced!');
