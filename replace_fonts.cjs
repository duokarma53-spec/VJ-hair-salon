const fs = require('fs');
const path = require('path');
const pagesDir = path.join(__dirname, 'src', 'pages');

fs.readdirSync(pagesDir).forEach(file => {
    if (!file.endsWith('.tsx')) return;
    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // For spans and dd elements that contain numbers/currency
    const regex = /<(span|dd|p)\s+className=[\"'\`]([^\"'\`]*?)heading-display([^\"'\`]*?)[\"'\`]\s*(style=\{[^}]+\})?>\s*(?:Rs\.|<IndianRupee|\{?[0-9a-zA-Z]+\.?)/g;
    
    let modified = false;
    content = content.replace(regex, (match, tag, before, after, styleAttr) => {
        modified = true;
        return `<${tag} className="${before}font-numbers${after}" ${styleAttr || ''}>`.replace(/\s+>/, '>');
    });

    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
    }
});
