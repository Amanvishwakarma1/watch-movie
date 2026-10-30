// Let a viewer account sign in to the dashboard and upload content (or take that away).
//   npm run user:admin -- <username>            give admin rights
//   npm run user:admin -- <username> --remove   take them away
// Runs against the database in .env, so it works for the live site too.
import { pool } from '../src/db/pool.js';
import { applySchema } from '../src/db/bootstrap.js';

const [name, flag] = process.argv.slice(2);
if (!name || (flag && flag !== '--remove')) {
  console.error('Usage: npm run user:admin -- <username> [--remove]');
  process.exit(1);
}

const grant = flag !== '--remove';
const username = name.trim().toLowerCase();

try {
  await applySchema();
  const result = await pool.query('UPDATE users SET is_admin = $1 WHERE username = $2', [grant, username]);
  if (!result.rowCount) {
    console.error(`No viewer account named '${username}'. Create it first with Sign in > Create account.`);
    process.exitCode = 1;
  } else {
    console.log(grant
      ? `'${username}' can now sign in at /admin/login and upload. Its password can no longer be reset from the site.`
      : `'${username}' is a regular viewer again.`);
    if (!grant) console.log('Sessions already signed in to the dashboard stay valid until they expire (8 h).');
  }
} catch (error) {
  console.error('Failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
