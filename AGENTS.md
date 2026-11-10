# Project rules

- Every /api/* route calls `getUserContext` (src/lib/server-user.ts) and uses the caller's own keys from `user_settings`; why: each account pays for its own AI and voice usage.
- The browser calls our API routes through `authFetch` (src/lib/auth-fetch.ts); why: routes reject requests without the user's session.
- The whole app sits behind `AuthGate` in __root (Google sign-in); why: everything is personal per account.
