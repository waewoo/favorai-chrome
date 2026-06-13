/**
 * Publishes the FavorAI extension to the Chrome Web Store.
 *
 * Required environment variables (put in .env or export before running):
 *   WEBSTORE_CLIENT_ID       — OAuth2 client ID from Google Cloud Console
 *   WEBSTORE_CLIENT_SECRET   — OAuth2 client secret
 *   WEBSTORE_REFRESH_TOKEN   — OAuth2 refresh token (one-time setup, see README)
 *   WEBSTORE_EXTENSION_ID    — Extension ID from the Chrome Web Store dashboard
 *
 * Usage:
 *   node scripts/publish.mjs              → upload only (no publish)
 *   node scripts/publish.mjs --publish    → upload + publish to all users
 *   node scripts/publish.mjs --testers    → upload + publish to testers only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load .env if present
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const { WEBSTORE_CLIENT_ID, WEBSTORE_CLIENT_SECRET, WEBSTORE_REFRESH_TOKEN, WEBSTORE_EXTENSION_ID } = process.env;

if (!WEBSTORE_CLIENT_ID || !WEBSTORE_CLIENT_SECRET || !WEBSTORE_REFRESH_TOKEN || !WEBSTORE_EXTENSION_ID) {
  console.error('❌ Missing required environment variables. Copy .env.example to .env and fill in the values.');
  console.error('   WEBSTORE_CLIENT_ID, WEBSTORE_CLIENT_SECRET, WEBSTORE_REFRESH_TOKEN, WEBSTORE_EXTENSION_ID');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
const version = manifest.version;
const zipName = `favorai-extension-v${version}.zip`;
const zipPath = path.join(rootDir, 'dist', zipName);

if (!fs.existsSync(zipPath)) {
  console.error(`❌ ZIP not found: dist/${zipName} — run "make package" first.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const doPublish = args.includes('--publish') || args.includes('--testers');
const publishTarget = args.includes('--testers') ? 'trustedTesters' : 'default';

// Step 1 — get a fresh access token
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: WEBSTORE_CLIENT_ID,
      client_secret: WEBSTORE_CLIENT_SECRET,
      refresh_token: WEBSTORE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error('❌ Failed to get access token:', data);
    process.exit(1);
  }
  return data.access_token;
}

// Step 2 — upload the ZIP
async function uploadZip(token) {
  console.log(`📦 Uploading ${zipName} (v${version})…`);
  const zipBuffer = fs.readFileSync(zipPath);
  const res = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${WEBSTORE_EXTENSION_ID}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-api-version': '2',
        'Content-Type': 'application/zip'
      },
      body: zipBuffer
    }
  );
  const data = await res.json();
  if (data.uploadState === 'FAILURE') {
    console.error('❌ Upload failed:', JSON.stringify(data.itemError || data, null, 2));
    process.exit(1);
  }
  console.log(`✅ Upload successful — state: ${data.uploadState}`);
  return data;
}

// Step 3 — publish
async function publish(token, target) {
  console.log(`🚀 Publishing to "${target}"…`);
  const res = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${WEBSTORE_EXTENSION_ID}/publish?publishTarget=${target}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-api-version': '2',
        'Content-Length': '0'
      }
    }
  );
  const data = await res.json();
  if (data.status?.includes('PUBLISH_FAILED') || res.status >= 400) {
    console.error('❌ Publish failed:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log(`✅ Published — status: ${JSON.stringify(data.status)}`);
}

(async () => {
  try {
    const token = await getAccessToken();
    await uploadZip(token);
    if (doPublish) {
      await publish(token, publishTarget);
    } else {
      console.log('ℹ️  Upload only (no publish). Use --publish to also publish.');
    }
    console.log(`\n🎉 Done! v${version} is on the Chrome Web Store.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
