# swifty.page

Database-backed Noodboi link page for Cloudflare Workers + D1. The public layout keeps the existing Noodboi design. `/admin` manages all eight existing links and any new entries.

## Editor features

- Add/edit entries; configure labels, URLs, descriptions, symbols, sections, display styles, 18+ badges, published state, and numeric sort order.
- Create custom text, URL, number, checkbox, and dropdown fields. Customize field labels, required state, dropdown choices, and public/editor-only visibility.
- Hide links without deleting their records. Required-field changes validate existing data first. Field keys and types stay stable after creation.
- Export a JSON backup containing fields and all links, including hidden entries. Backup files may include private field values; keep them private.
- The public page reads published entries from D1 on each page load. Private fields are omitted server-side. The original static links remain as a fallback if the database API is unavailable.

## Connect the existing Cloudflare Worker

Preserve the Worker currently serving `swifty.page`, its custom domain, and any existing settings. The repository has no account credentials or existing Worker ID, so deployment requires an authenticated Cloudflare session. Do not point this config at a different Worker accidentally.

Use the Cloudflare dashboard or an authenticated terminal with the official Wrangler CLI:

1. Create a D1 database named `swifty-page-links` (or choose a database you own). For example: `npx wrangler d1 create swifty-page-links`.
2. Configure the actual database UUID and current Worker name:
   `node scripts/configure.mjs --worker-name YOUR_EXISTING_WORKER --database-id ACTUAL_D1_UUID`
   If you chose a different database name, update `database_name` in `wrangler.jsonc` too. Commit this config so Git deployments preserve the binding.
3. Apply the schema and initial link data to that database:
   ```sh
   npx wrangler d1 migrations apply DB --remote
   npx wrangler d1 execute DB --remote --file=seed.sql
   ```
   `seed.sql` uses `INSERT OR IGNORE`; rerunning it won't overwrite edited records. Migrations are schema-only. Do not edit an already-applied migration.
4. Set a long, random editor key through the protected prompt:
   `npx wrangler secret put ADMIN_TOKEN`
   Use at least 32 characters, store it in a password manager, and enter it only in the editor. Never commit this secret or pass it as a shell argument.
5. Build and deploy to the existing Worker:
   ```sh
   npm run build
   npx wrangler deploy
   ```
   For Cloudflare Workers Builds, set the build command to `npm run build` and deployment command to `npx wrangler deploy`; verify the configured Worker name matches the Worker serving the domain. The config's build hook also prepares assets when Wrangler deploy runs directly. Apply remote migrations before the first deployment.
6. Open `https://swifty.page/admin`, unlock the editor with the key, and make an edit. Reload the public page and verify it appears. Both `/` and `/noodboi.com/` use the same database.

Cloudflare dashboard equivalent: add the D1 binding named `DB`, initialize the database using the SQL files, and add an encrypted secret named `ADMIN_TOKEN` under the existing Worker's settings. Keep the configuration file aligned with these settings because Wrangler can replace dashboard bindings during deployment.

## Local verification

`npm test` runs API integration tests against real SQLite, including persistence, unpublished/private filtering, URL validation, authorization, origin checks, conflict detection, and idempotent seed import. Node 24+ is needed for the built-in SQLite test adapter. The deployed Worker does not use Node SQLite.

For local preview after configuring D1:

```sh
npx wrangler d1 migrations apply DB --local
npx wrangler d1 execute DB --local --file=seed.sql
npm run build
npx wrangler dev
```

Put a development-only `ADMIN_TOKEN` into the ignored `.dev.vars` file for local preview. Local databases and production D1 are separate. Never share your production editor key with preview deployments.

## Repository layout

- `src/worker.js`: public read API and protected admin API.
- `public/`: public site, admin UI, and browser scripts. This is the source of static assets.
- `migrations/0001_links.sql`: database schema.
- `seed.sql`: initial field definitions and eight existing link entries.
- `wrangler.jsonc`: Worker and assets configuration; configure a real D1 ID before database deployment.
- `index.html`, `noodboi.com/index.html`: compatibility copies maintained by the build script.

The editor key stays only in browser memory. All writes require it and a matching Origin. API responses are not cached. Authenticated exports contain private data; public responses do not. If D1 or the editor secret is missing, editing returns a clear setup error instead of silently using browser storage.
