# Email Sender

Private, one-to-one sponsorship outreach for CSI VIT. Import up to 100 contacts, personalize a message from spreadsheet columns, review every recipient, and send individual emails through the user’s own Gmail account.

The repository is public. The app’s data and sending APIs are private per signed-in user. A public GitHub repository does not contain live Supabase or Google credentials.

## What it does

- Google sign-in, followed by a separate Gmail send-only connection. The connected address is read-only and must match the sign-in account.
- CSV and `.xlsx` contact import, worksheet selection, recipient-email mapping, blank-row filtering, duplicate detection, and row-level validation.
- Editable subject and rich-text message with `[Column Name]`, `[Your Name]`, `[Your Email]`, and `[Your Phone Number]` placeholders.
- Private named templates and sender profile; private file attachments with a combined 10 MB per-campaign limit.
- Personalized previews, a test email to the sender, and a recipient-count confirmation before sending.
- Background, sequential sending with durable status. Results distinguish accepted, failed, skipped, and uncertain sends. Uncertain sends require an explicit duplicate-risk acknowledgement before retry.
- Private batch history and downloadable CSV results. Batch data and unreferenced attachments expire after 30 days; account deletion erases the user’s stored workspace.
- Hard limits: 100 contacts per batch, one active batch per user, 100 send attempts per user per UTC day, and 2,000 attempts per app per UTC month. Tests and retries count toward usage. App attachment storage is capped at 500 MB, with 50 MB per user.

“Accepted” means Gmail accepted the API request. It does not guarantee that the message reached the recipient’s inbox.

## Stack

React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TipTap, Netlify Functions, Supabase Auth/Postgres/Storage, Google OAuth, and the Gmail API.

## Run locally

1. Install Node.js 22 and dependencies: `npm install`.
2. Copy `.env.example` to `.env.local` and fill in a Supabase project URL and publishable/anon key.
3. Apply `supabase/migrations/202610080001_initial_schema.sql` in the Supabase SQL Editor, or link the Supabase CLI to the project and run `supabase db push`.
4. Configure Google sign-in in Supabase Auth and add the local redirect URL `http://localhost:8888` to the Supabase redirect allow-list.
5. Add the server-only Google and Supabase values from `.env.example` to the local Netlify environment.
6. Start the app through Netlify Dev so its functions are available: `npx netlify dev`.

`npm run dev` starts only the Vite frontend. The protected API and background sender need Netlify Functions; use Netlify Dev for an end-to-end local run.

For a type/build check without credentials, run `npm run build`, `npm run check:functions`, and `npm test`.

## Supabase setup

Create a Supabase project, then apply the migration. It creates owner-scoped tables, a private `attachments` bucket, storage policies, and service-role-only RPCs for rate limits, batch creation, dispatch leases, quotas, and retries. Do not expose the service-role key to the browser.

In Supabase Auth, enable Google and configure its OAuth client ID and secret. Add the site and local callback URLs to the Supabase redirect allow-list. Google sign-in requests only identity scopes; Gmail sending is authorized separately by a server-side OAuth flow.

## Google OAuth and Gmail sending

Use one Google OAuth Web application for Supabase sign-in and the separate Gmail connection. Enable the Gmail API. Configure these authorized redirect URIs:

- Supabase callback: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- Gmail connection callback: `https://YOUR_NETLIFY_SITE/.netlify/functions/gmail-callback`
- For local development, the Gmail callback is `http://localhost:8888/.netlify/functions/gmail-callback`.

The Google OAuth consent screen should be External for the initial team rollout. Add the team’s Google accounts as test users while the consent screen is in testing. Google may show an unverified-app warning and restrict the number of users; broader access requires completing Google’s verification process. Review [Google’s OAuth verification guidance](https://support.google.com/cloud/answer/13464323) and [unverified-app user caps](https://support.google.com/cloud/answer/7454865) before inviting users.

The Gmail connection requests `gmail.send` plus OpenID/email/profile identity scopes. Its signed state is short-lived and tied to the signed-in user. The callback confirms the Google address matches that user, encrypts the refresh token with AES-256-GCM, and stores only the encrypted token server-side. Disconnecting removes the stored token; users can revoke Google consent from their Google Account settings too.

## Netlify environment

Set these variables for the production deploy and deploy previews. Keep the two `VITE_` variables limited to Supabase’s browser-safe URL and publishable/anon key. All other values are server-only:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
- `GMAIL_STATE_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY`, `WORKER_SECRET`

Generate three independent random values for the last three secrets; each must have at least 32 characters. Netlify supplies the deployed site URL to functions. Configure Supabase Auth’s Site URL and redirect allow-list for the final Netlify URL. Use free plans only; provider quotas can pause service, and this project does not configure paid upgrades or automatic recharge.

Netlify deploys the scheduled recovery function every five minutes and a daily retention cleanup. The background sender uses a server-only worker secret, a database lease, idempotent batch creation, a database quota reservation for each attempt, and per-recipient durable states. If execution stops during a Gmail request, that recipient becomes “Needs review” after its lease expires and is never automatically resent.

## Privacy and deletion

See [Privacy](public/privacy.html) and [Terms](public/terms.html). Profiles and templates persist until deleted. Campaign rows and attached files are retained for up to 30 days. A signed-in user can delete an individual campaign, an unused stored attachment, or their entire account from Account settings. Account deletion removes the Google refresh token, database records, and private storage objects.

## Before launch

- Apply the Supabase migration and configure Google/Supabase OAuth.
- Add the production Netlify environment variables; do not commit `.env.local`.
- Confirm the actual free-plan quotas and Google OAuth testing/verification requirements for your accounts.
- Test only with controlled addresses first, including Gmail reconnection, attachment handling, and uncertain-result review.
- Publish the privacy and terms pages from this repository and replace the CSI VIT contact details with the team’s chosen support address if needed.
