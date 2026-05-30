import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = manifest.version;
const zipName = `favorai-extension-v${version}.zip`;

console.log(`Packaging FavorAI extension v${version}...`);

// Create a temp directory dist/ for packaging
const distDir = 'dist';
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// Folders/files to copy to package
// Only these files/folders are included in the extension ZIP.
// store-assets/, tests/, scripts/, node_modules/ are intentionally excluded.
const filesToCopy = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'popup-light.html',
  'popup-light.js',
  'privacy_policy.html',
  '_locales',
  'src',
  'icons',
  'fonts'
];

for (const item of filesToCopy) {
  if (fs.existsSync(item)) {
    const stat = fs.statSync(item);
    if (stat.isDirectory()) {
      fs.cpSync(item, path.join(distDir, item), { recursive: true });
    } else {
      fs.copyFileSync(item, path.join(distDir, item));
    }
  }
}

// Zip the dist folder contents
if (fs.existsSync(zipName)) {
  fs.unlinkSync(zipName);
}

try {
  if (process.platform === 'win32') {
    // Windows PowerShell Compress-Archive
    const absoluteDist = path.resolve(distDir);
    const absoluteZip = path.resolve(zipName);
    execSync(`powershell.exe -Command "Compress-Archive -Path '${absoluteDist}/*' -DestinationPath '${absoluteZip}' -Force"`);
  } else {
    // Unix zip
    execSync(`cd ${distDir} && zip -r ../${zipName} ./*`);
  }
  console.log(`Successfully created package: ${zipName}`);
} catch (error) {
  console.error('Error creating zip package:', error.message);
  process.exit(1);
} finally {
  // Clean up temp dist directory
  fs.rmSync(distDir, { recursive: true, force: true });
}
