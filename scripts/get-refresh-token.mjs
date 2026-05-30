/**
 * One-time script to obtain the OAuth2 refresh token for Chrome Web Store publishing.
 *
 * Run ONCE:  node scripts/get-refresh-token.mjs
 * Then copy the refresh token into your .env file.
 *
 * Prerequisites: fill WEBSTORE_CLIENT_ID and WEBSTORE_CLIENT_SECRET in .env first.
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const { WEBSTORE_CLIENT_ID, WEBSTORE_CLIENT_SECRET } = process.env;
if (!WEBSTORE_CLIENT_ID || !WEBSTORE_CLIENT_SECRET) {
  console.error('❌ Set WEBSTORE_CLIENT_ID and WEBSTORE_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:8989';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';

const authUrl =
  `https://accounts.google.com/o/oauth2/auth` +
  `?client_id=${encodeURIComponent(WEBSTORE_CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\n1. Open this URL in your browser:\n');
console.log('   ' + authUrl);
console.log('\n2. Log in with your Google account and allow access.');
console.log('3. You will be redirected to localhost — waiting...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  if (!code) { res.end('No code'); return; }

  res.end('<h2>✅ Got the code! You can close this tab.</h2>');
  server.close();

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: WEBSTORE_CLIENT_ID,
      client_secret: WEBSTORE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });
  const data = await tokenRes.json();

  if (!data.refresh_token) {
    console.error('❌ No refresh token received:', data);
    process.exit(1);
  }

  console.log('✅ Your refresh token:\n');
  console.log('   ' + data.refresh_token);
  console.log('\nAdd this line to your .env file:');
  console.log(`   WEBSTORE_REFRESH_TOKEN=${data.refresh_token}\n`);
});

server.listen(8989);
