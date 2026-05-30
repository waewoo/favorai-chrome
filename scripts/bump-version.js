import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const manifestPath = path.join(rootDir, 'manifest.json');
const packagePath = path.join(rootDir, 'package.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`❌ manifest.json not found at ${manifestPath}`);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  console.error(`❌ package.json not found at ${packagePath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const currentVersion = manifest.version || '1.0.0';

const args = process.argv.slice(2);
const type = args[0] || 'patch';

let newVersion;

if (type === 'major' || type === 'minor' || type === 'patch') {
  const parts = currentVersion.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.error(`❌ Invalid current version in manifest.json: ${currentVersion}`);
    process.exit(1);
  }

  if (type === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else if (type === 'patch') {
    parts[2] += 1;
  }
  newVersion = parts.join('.');
} else {
  // Assume user provided a direct version number (e.g. 1.2.3)
  if (!/^\d+\.\d+\.\d+$/.test(type)) {
    console.error(`❌ Invalid version or bump type: "${type}". Expected 'major', 'minor', 'patch', or a specific version like '1.2.3'.`);
    process.exit(1);
  }
  newVersion = type;
}

manifest.version = newVersion;
packageJson.version = newVersion;

// Write files back with proper formatting and trailing newline
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

console.log(`✅ Bumped version from ${currentVersion} to ${newVersion} in manifest.json & package.json`);
