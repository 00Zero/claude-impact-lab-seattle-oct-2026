# Google sign-in

The `/sign-in` page uses NextAuth.js v5 (the `next-auth@beta` release documented by Auth.js), Google OAuth, and encrypted JWT session cookies. No database is required for this initial login flow. Users go to `/requests/new` after successful authentication. Visitors who already have a session are redirected from `/sign-in` to `/requests/new`. The home page shows Sign in beside Get started; signed-in visitors see New request and Sign out instead. Signing out returns to `/`. This does not yet persist an early-access registration or create an application dashboard.

## Local setup

Install dependencies with `npm install` if needed. In the repository root, populate the ignored `.env.local` file:

```dotenv
AUTH_GOOGLE_ID=your-google-oauth-client-id
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
AUTH_SECRET=your-random-session-encryption-secret
AUTH_URL=http://localhost:3000
```

Generate `AUTH_SECRET` with `openssl rand -base64 32` and paste the result into `.env.local`. Keep it stable between restarts. These variables are server-only; never prefix them with `NEXT_PUBLIC_` or commit credentials.

In Google Cloud Console, configure the OAuth consent screen and create an OAuth client of type **Web application**. Register:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

If the consent screen is in testing mode, add the Google accounts you will use as test users. Restart the development server after changing environment variables, then visit `/sign-in` and choose **Continue with Google**.

Until all three credentials are configured, the page shows an unavailable message and disables the login button. Authentication errors return to the same styled page with a retry message. Sign-in and sign-out use POST-based Server Actions with pending states.

## Production

Set the same environment variables in the hosting provider's secret configuration; `.env.local` is not deployed through Git. Set `AUTH_URL` to the public HTTPS origin and register its exact `/api/auth/callback/google` redirect URI with Google. Add a separate OAuth client for production if you want to isolate environments.

The `/requests/new` route requires a valid session. Future protected pages and server actions should also verify the session using `auth()` from `@/auth` before accessing private data.

## Required profile

After login, `/requests/new` checks for a valid profile in this browser's local storage, keyed by the authenticated user's ID (`ringaround:user-profile:v1:<user-id>`). Missing, malformed, or incomplete profiles open a required modal for name, phone number, optional company, and default address. Escape and backdrop clicks do not dismiss it. The request form becomes available only after validation and a successful local-storage write. If storage is blocked or full, the modal stays open and explains how to retry.

Returning users with a valid profile skip the modal. Their default address is selected in the request form, and request drafts are also stored per user. Profiles do not sync across devices or browsers; clearing browser storage requires entering the details again. Local profile validation is a UI requirement, not a substitute for server authorization or address/phone verification.

References: [Auth.js installation](https://authjs.dev/getting-started/installation), [Google provider](https://authjs.dev/getting-started/providers/google).
