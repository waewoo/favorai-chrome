import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const manifestPath = path.join(rootDir, 'manifest.json');
const packagePath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

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
let bumpType = args[0] || 'auto'; // 'auto', 'major', 'minor', 'patch', or a specific version (e.g. 1.2.3)

// 1. Fetch commits since the last tag
let lastTag = '';
let commits = [];
let isGit = false;

try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  isGit = true;
} catch (e) {
  // Not a git repo
}

if (isGit) {
  try {
    lastTag = execSync('git describe --tags --abbrev=0', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch (e) {
    // No tags exist
  }

  const gitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  
  try {
    const delimiter = '===COMMIT_SEPARATOR===';
    const format = `%h%n%s%n%b${delimiter}`;
    const logOutput = execSync(`git log ${gitRange} --format="${format}"`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
    
    const rawCommits = logOutput.split(delimiter);
    for (const raw of rawCommits) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      
      const lines = trimmed.split('\n');
      const hash = lines[0].trim();
      const subject = lines[1] ? lines[1].trim() : '';
      const body = lines.slice(2).join('\n').trim();
      
      commits.push({ hash, subject, body });
    }
  } catch (e) {
    console.warn('⚠️ Could not fetch git commits.');
  }
}

// 2. Determine bump type
if (bumpType === 'auto') {
  if (!isGit) {
    console.warn('⚠️ Not a git repository. Defaulting to patch bump.');
    bumpType = 'patch';
  } else if (commits.length === 0) {
    console.log(`ℹ️ No new commits found since last tag (${lastTag || 'initial'}). Version remains ${currentVersion}.`);
    process.exit(0);
  } else {
    bumpType = analyzeBumpType(commits);
    console.log(`🔍 Auto-detected bump type: ${bumpType.toUpperCase()} (based on ${commits.length} commits since ${lastTag || 'initial'})`);
  }
}

// 3. Compute new version
let newVersion;
if (bumpType === 'major' || bumpType === 'minor' || bumpType === 'patch') {
  const parts = currentVersion.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.error(`❌ Invalid current version in manifest.json: ${currentVersion}`);
    process.exit(1);
  }

  if (bumpType === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (bumpType === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else if (bumpType === 'patch') {
    parts[2] += 1;
  }
  newVersion = parts.join('.');
} else {
  // Assume user provided a direct version number (e.g. 1.2.3)
  if (!/^\d+\.\d+\.\d+$/.test(bumpType)) {
    console.error(`❌ Invalid version or bump type: "${bumpType}". Expected 'auto', 'major', 'minor', 'patch', or a specific version like '1.2.3'.`);
    process.exit(1);
  }
  newVersion = bumpType;
}

// 4. Update manifest.json & package.json
manifest.version = newVersion;
packageJson.version = newVersion;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log(`✅ Updated manifest.json & package.json to v${newVersion}`);

// 5. Update CHANGELOG.md and create Git commit & tag
let changelogNotes = null;
if (isGit && commits.length > 0) {
  changelogNotes = updateChangelog(commits, newVersion);
}

if (isGit) {
  try {
    const filesToCommit = fs.existsSync(changelogPath) && changelogNotes ? 'manifest.json package.json CHANGELOG.md' : 'manifest.json package.json';
    
    console.log('📦 Committing release files...');
    execSync(`git commit ${filesToCommit} -m "chore(release): v${newVersion}"`, { stdio: 'inherit' });
    
    console.log(`🏷️ Creating annotated Git tag v${newVersion}...`);
    const tagMessage = `Release v${newVersion}\n\n${changelogNotes || 'Manual version increment.'}`;
    // Use stdin to pass the multi-line tag message safely to avoid escaping issues
    execSync(`git tag -a v${newVersion} --file=-`, { input: tagMessage, stdio: ['pipe', 'inherit', 'inherit'] });
    
    console.log(`✅ Release v${newVersion} committed and tagged locally!`);
  } catch (err) {
    console.error('❌ Failed to execute Git commands:', err.message);
  }
}

// 6. Print next steps
console.log('\n======================================================');
console.log(` Release v${newVersion} prepared, committed, and tagged!`);
console.log('======================================================');
console.log('To push the release to the remote repository, run:');
console.log(`  git push origin main --tags`);
console.log('======================================================\n');

function analyzeBumpType(commitsList) {
  let hasMajor = false;
  let hasMinor = false;

  const conventionalPattern = /^(\w+)(?:\(([^)]+)\))?(!?):\s*(.*)$/;

  for (const commit of commitsList) {
    const { subject, body } = commit;

    // Check for breaking changes in subject or body
    const isBreaking = 
      subject.includes('BREAKING CHANGE:') || 
      subject.includes('BREAKING CHANGES:') ||
      body.includes('BREAKING CHANGE:') ||
      body.includes('BREAKING CHANGES:');

    if (isBreaking) {
      hasMajor = true;
      continue;
    }

    const match = subject.match(conventionalPattern);
    if (match) {
      const type = match[1].toLowerCase();
      const breakingMark = match[3];

      if (breakingMark === '!') {
        hasMajor = true;
      } else if (type === 'feat') {
        hasMinor = true;
      }
    }
  }

  if (hasMajor) return 'major';
  if (hasMinor) return 'minor';
  return 'patch';
}

function updateChangelog(commitsList, version) {
  if (!fs.existsSync(changelogPath)) {
    console.warn(`⚠️ CHANGELOG.md not found. Skipping changelog update.`);
    return null;
  }

  const added = [];
  const fixed = [];
  const changed = [];

  const conventionalPattern = /^(\w+)(?:\(([^)]+)\))?(!?):\s*(.*)$/;

  for (const commit of commitsList) {
    const { subject, hash } = commit;
    
    // Ignore release commits to prevent cluttering the changelog
    if (subject.startsWith('chore(release):')) continue;

    const match = subject.match(conventionalPattern);
    let description = subject;
    let type = 'changed';

    if (match) {
      const rawType = match[1].toLowerCase();
      const scope = match[2];
      const detail = match[4];

      if (rawType === 'feat') {
        type = 'added';
        description = scope ? `**${scope}**: ${detail}` : detail;
      } else if (rawType === 'fix') {
        type = 'fixed';
        description = scope ? `**${scope}**: ${detail}` : detail;
      } else {
        type = 'changed';
        description = scope ? `**${scope}** (${rawType}): ${detail}` : `(${rawType}) ${detail}`;
      }
    }

    // Capitalize first letter
    description = description.charAt(0).toUpperCase() + description.slice(1);
    
    const entry = `- ${description} (\`${hash}\`)`;

    if (type === 'added') added.push(entry);
    else if (type === 'fixed') fixed.push(entry);
    else changed.push(entry);
  }

  // If no release-worthy commits remain after filtering
  if (added.length === 0 && fixed.length === 0 && changed.length === 0) {
    return null;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  let notesBlock = '';
  if (added.length > 0) {
    notesBlock += `### Added\n${added.join('\n')}\n\n`;
  }
  if (changed.length > 0) {
    notesBlock += `### Changed\n${changed.join('\n')}\n\n`;
  }
  if (fixed.length > 0) {
    notesBlock += `### Fixed\n${fixed.join('\n')}\n\n`;
  }

  let changelogBlock = `## [${version}] - ${dateStr}\n\n` + notesBlock;

  let changelogContent = fs.readFileSync(changelogPath, 'utf8');
  const firstEntryIndex = changelogContent.indexOf('## [');
  
  if (firstEntryIndex !== -1) {
    changelogContent = 
      changelogContent.slice(0, firstEntryIndex) + 
      changelogBlock + 
      changelogContent.slice(firstEntryIndex);
  } else {
    changelogContent = changelogContent.trim() + '\n\n' + changelogBlock;
  }

  fs.writeFileSync(changelogPath, changelogContent, 'utf8');
  console.log(`📝 Updated CHANGELOG.md with release notes for v${version}`);

  return notesBlock;
}
