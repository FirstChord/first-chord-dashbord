#!/usr/bin/env node
/**
 * Mint a Gmail `gmail.send` refresh token for First Chord practice-note emails.
 *
 * Run locally (it needs an interactive Google sign-in as the sender account):
 *
 *   node scripts/mint-gmail-token.mjs
 *
 * It will ask for the OAuth client ID + secret (use a "Desktop app" client in the
 * same Google Cloud project as the Internal consent screen), print a consent URL,
 * and — after you approve as musiclessons@firstchord.co.uk — print the
 * GMAIL_REFRESH_TOKEN to paste into Railway.
 *
 * Nothing is written to disk and no existing env vars are read or changed.
 */
import http from 'node:http';
import readline from 'node:readline';
import { URL } from 'node:url';
import { google } from 'googleapis';

const PORT = 4567;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

function ask(question, { mask = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (mask) {
      // Hide the secret as it is typed.
      const onData = (char) => {
        if (['\n', '\r', ''].includes(char.toString())) {
          process.stdin.removeListener('data', onData);
        } else {
          process.stdout.write('[2K[200D' + question + '*'.repeat(rl.line.length));
        }
      };
      process.stdin.on('data', onData);
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('\nFirst Chord — Gmail refresh-token minter\n');
  console.log('Use the OAuth client from the SAME project as your Internal consent screen.');
  console.log('A "Desktop app" client is recommended (no redirect-URI setup needed).\n');

  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID || await ask('OAuth client ID: ');
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET || await ask('OAuth client secret: ', { mask: true });

  if (!clientId || !clientSecret) {
    console.error('\nBoth client ID and client secret are required.');
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token even if previously approved
    scope: [SCOPE],
  });

  console.log('\n1. Open this URL in a browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Sign in as the SENDER account (musiclessons@firstchord.co.uk) and approve.\n');
  console.log(`   (Waiting for the redirect to ${REDIRECT_URI} …)\n`);

  const server = http.createServer(async (req, res) => {
    if (!req.url.startsWith('/oauth2callback')) {
      res.writeHead(404).end();
      return;
    }
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(`<p>Authorization failed: ${error}. You can close this tab.</p>`);
      console.error(`\nAuthorization failed: ${error}`);
      server.close();
      process.exit(1);
    }

    try {
      const { tokens } = await oauth2.getToken(code);
      res.writeHead(200, { 'Content-Type': 'text/html' }).end('<p>Done. You can close this tab and return to the terminal.</p>');
      server.close();

      if (!tokens.refresh_token) {
        console.error('\nNo refresh token was returned. Remove the app under the account\'s "Third-party access" and run again (the script forces prompt=consent, so this is rare).');
        process.exit(1);
      }

      console.log('\n✅ Success. Set this in Railway as GMAIL_REFRESH_TOKEN:\n');
      console.log(`   ${tokens.refresh_token}\n`);
      console.log('Also set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to the client you used here,');
      console.log('so the running app redeems the token with the same client.\n');
      process.exit(0);
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end('<p>Token exchange failed. Check the terminal.</p>');
      console.error('\nToken exchange failed:', err.message || err);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
