import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('dist');
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(path.join(outDir, 'src'), { recursive: true });
await fs.copyFile('index.html', path.join(outDir, 'index.html'));
await fs.copyFile('src/app.js', path.join(outDir, 'src/app.js'));
await fs.copyFile('src/styles.css', path.join(outDir, 'src/styles.css'));
console.log('Built static frontend into dist/.');
