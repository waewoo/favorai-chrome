import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = manifest.version;
const zipName = `favorai-extension-v${version}.zip`;
const distRoot = 'dist';
const packageDir = path.join(distRoot, 'package');
const zipPath = path.join(distRoot, zipName);

console.log(`Packaging FavorAI extension v${version}...`);

// Keep generated artifacts under dist/ so the project root stays focused on source and docs.
if (!fs.existsSync(distRoot)) {
  fs.mkdirSync(distRoot, { recursive: true });
}
if (fs.existsSync(packageDir)) {
  fs.rmSync(packageDir, { recursive: true, force: true });
}
fs.mkdirSync(packageDir, { recursive: true });

// Folders/files to copy to package
// Only these files/folders are included in the extension ZIP.
// store-assets/, tests/, scripts/, node_modules/ are intentionally excluded.
const filesToCopy = [
  'manifest.json',
  'extension',
  '_locales',
  'src',
  'assets'
];

for (const item of filesToCopy) {
  if (fs.existsSync(item)) {
    const stat = fs.statSync(item);
    if (stat.isDirectory()) {
      fs.cpSync(item, path.join(packageDir, item), { recursive: true });
    } else {
      fs.copyFileSync(item, path.join(packageDir, item));
    }
  }
}

// Zip the package staging folder contents
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

try {
  if (process.platform === 'win32') {
    // Windows PowerShell Compress-Archive
    const absolutePackageDir = path.resolve(packageDir);
    const absoluteZip = path.resolve(zipPath);
    execSync(`powershell.exe -Command "Compress-Archive -Path '${absolutePackageDir}/*' -DestinationPath '${absoluteZip}' -Force"`);
  } else {
    // Unix zip
    execSync(`cd ${packageDir} && zip -r ../${zipName} ./*`);
  }
  console.log(`Successfully created package: ${zipPath}`);
} catch (error) {
  console.error('Error creating zip package:', error.message);
  process.exit(1);
} finally {
  // Clean up the temporary staging directory but keep the generated ZIP in dist/.
  fs.rmSync(packageDir, { recursive: true, force: true });
}
