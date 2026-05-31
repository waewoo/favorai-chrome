import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const manifestPath = path.join(rootDir, 'manifest.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

if (!fs.existsSync(manifestPath)) {
  console.error(`❌ manifest.json not found.`);
  process.exit(1);
}
if (!fs.existsSync(changelogPath)) {
  console.error(`❌ CHANGELOG.md not found.`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const args = process.argv.slice(2);
const version = args[0] || manifest.version;
const tag = `v${version}`;
const zipName = `favorai-extension-${tag}.zip`;

console.log(`🚀 Preparing GitHub Release for ${tag}...`);

// 1. Read CHANGELOG.md and extract notes for this version
const changelogContent = fs.readFileSync(changelogPath, 'utf8');

// Find the block under `## [version]`
const versionHeaderRegex = new RegExp(`##\\s*\\[${version.replace(/\./g, '\\.')}\\][^\n]*`); // eslint-disable-line security/detect-non-literal-regexp
const match = changelogContent.match(versionHeaderRegex);

if (!match) {
  console.error(`❌ Could not find version [${version}] in CHANGELOG.md`);
  process.exit(1);
}

const startIndex = match.index + match[0].length;
// Find the next ## [ version header
const nextHeaderMatch = changelogContent.slice(startIndex).match(/##\s*\[\d+\.\d+\.\d+\]/);
const endIndex = nextHeaderMatch ? startIndex + nextHeaderMatch.index : changelogContent.length;

let rawNotes = changelogContent.slice(startIndex, endIndex).trim();

// Clean up any carriage returns
rawNotes = rawNotes.replace(/\r\n/g, '\n');

// 2. Determine previous version from CHANGELOG.md
let prevVersion = null;
if (nextHeaderMatch) {
  const prevHeaderStr = nextHeaderMatch[0];
  const prevVersionMatch = prevHeaderStr.match(/\[(\d+\.\d+\.\d+)\]/);
  if (prevVersionMatch) {
    prevVersion = prevVersionMatch[1];
  }
}

// 3. Construct notes body
let finalNotes = rawNotes;

// Remove redundant title if it starts with "Release vX.Y.Z"
if (finalNotes.startsWith(`Release v${version}`)) {
  finalNotes = finalNotes.slice(`Release v${version}`.length).trim();
}

if (prevVersion) {
  const compareUrl = `https://github.com/waewoo/favorai-chrome/compare/v${prevVersion}...v${version}`;
  finalNotes += `\n\n**Full Changelog**: ${compareUrl}`;
} else {
  // If there's no previous tag in changelog, try to compare to initial commit
  // Let's keep it clean: no compare url if it's the very first release in changelog.
}

console.log('--- Release Notes ---');
console.log(finalNotes);
console.log('---------------------');

// 4. Check if release already exists on GitHub
let releaseExists = false;
try {
  execSync(`gh release view ${tag}`, { stdio: 'ignore' });
  releaseExists = true;
} catch {
  // Release doesn't exist
}

// Check or build ZIP if needed
const zipExists = fs.existsSync(zipName);
if (!zipExists) {
  if (!releaseExists) {
    console.error(`❌ Zip file ${zipName} not found. Running packaging script first...`);
    if (version === manifest.version) {
      try {
        execSync('node scripts/package.js', { stdio: 'inherit' });
      } catch (e) {
        console.error('❌ Failed to automatically package extension:', e.message);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  } else {
    console.log(`⚠️ Local ZIP file ${zipName} not found, but release exists on GitHub. Skipping asset upload.`);
  }
}

// Use standard options for gh release commands
if (releaseExists) {
  console.log(`📝 Release ${tag} already exists on GitHub. Editing release notes...`);
  execSync(`gh release edit ${tag} --notes-file=-`, {
    input: finalNotes,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (fs.existsSync(zipName)) {
    console.log(`📤 Uploading/replacing asset ${zipName}...`);
    execSync(`gh release upload ${tag} "${zipName}" --clobber`, { stdio: 'inherit' });
  }
  console.log(`✅ GitHub Release ${tag} updated successfully!`);
} else {
  console.log(`🚀 Creating brand new GitHub Release ${tag}...`);
  execSync(`gh release create ${tag} "${zipName}" --title "${tag}" --notes-file=-`, {
    input: finalNotes,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  console.log(`✅ GitHub Release ${tag} created successfully!`);
}
