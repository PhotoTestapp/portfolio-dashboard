# Supabase minimum migration kit

This folder contains the minimum backend migration scaffold for moving away from localStorage-only operation.

## Apply order

1. Create a Supabase project.
2. Open SQL Editor.
3. Execute `schema.sql`.
4. Enable email or magic-link authentication.
5. Copy `.env.example` to `.env.local`.
6. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
7. Run `npm run build`.

## Tables

- `portfolio_state`: latest JSON state per user with revision/hash.
- `audit_log`: append-only user audit events.
- `decision_history`: backend-ready decision snapshots.

## Security constraints

- RLS must remain enabled.
- Use anon key only in frontend.
- Never commit service_role keys.
- Server-side API is still required for broker APIs, paid data APIs, and URL/PDF body verification.
