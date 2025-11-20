#!/usr/bin/env node
/**
 * Usage:
 *
 * GITHUB_TOKEN=ghp_xxx npm run create-github-repo -- my-new-repo --private
 *
 * The script will:
 * - determine your GitHub username from the token
 * - create a new repo under your account (unless it already exists)
 * - create a `songs.json` file at the repo root (or specified path) with initial demo songs
 * - print the raw.githubusercontent.com URL you can use in the app
 */

const args = process.argv.slice(2);
const repoName = args[0];
const isPrivate = args.includes('--private');
const pathIndex = args.indexOf('--path');
const filePath = pathIndex !== -1 && args[pathIndex+1] ? args[pathIndex+1] : 'songs.json';
const branchIndex = args.indexOf('--branch');
const branch = branchIndex !== -1 && args[branchIndex+1] ? args[branchIndex+1] : 'main';

if (!repoName) {
  console.error('Usage: GITHUB_TOKEN=... npm run create-github-repo -- <repo-name> [--private] [--path <path>] [--branch <branch>]');
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('Please set GITHUB_TOKEN environment variable with a Personal Access Token (repo scope).');
  process.exit(1);
}

const fetch = global.fetch || require('node-fetch');

const DEMO_SONGS = [
  { id: 's1', title: 'Pieseň radosti', category: 'hymns', lyrics: `1. Pieseň radosti\nRef: Sláva Bohu\n2. Spievajme dnes` },
  { id: 's2', title: 'Tichá modlitba', category: 'chorales', lyrics: `Tichá modlitba, smelé srdce.` },
  { id: 's3', title: 'Svetlo na ceste', category: 'gospels', lyrics: `Svetlo vedie nás, kráčaj s nádejou.` }
];

(async function main(){
  try {
    // get user
    const u = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!u.ok) throw new Error('Failed to get user: ' + u.statusText);
    const user = await u.json();
    const owner = user.login;
    console.log('Authenticated as', owner);

    // create repo
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: repoName, private: !!isPrivate, auto_init: true })
    });

    if (createRes.status === 422) {
      console.log('Repository may already exist. Continuing...');
    } else if (!createRes.ok) {
      const txt = await createRes.text();
      throw new Error('Failed to create repo: ' + createRes.status + ' ' + txt);
    } else {
      const cr = await createRes.json();
      console.log('Created repository:', cr.full_name);
    }

    // prepare content
    const contentStr = JSON.stringify(DEMO_SONGS, null, 2);
    const contentB64 = Buffer.from(contentStr, 'utf8').toString('base64');

    // create or update file via contents API
    const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`;

    // check if exists to get sha
    let sha;
    const getRes = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } });
    if (getRes.ok) {
      const g = await getRes.json();
      sha = g.sha;
      console.log('Existing file detected, will update it.');
    }

    const putBody = { message: 'Add songs.json from tvdisplay', content: contentB64 };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(apiUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(putBody) });
    if (!putRes.ok) {
      const t = await putRes.text();
      throw new Error('Failed to create/update file: ' + putRes.status + ' ' + t);
    }
    const putData = await putRes.json();
    console.log('Created/updated file at', putData.content.path);

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${filePath}`;
    console.log('\nRAW URL (use this in ControlPage -> GitHub Sync raw URL):\n', rawUrl);
    console.log('\nDone.');
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
})();
