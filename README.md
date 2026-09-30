# Dream Town Surprises — Online Supabase Version

This version uses Supabase Auth and PostgreSQL instead of browser localStorage.

## Before deploying
1. The Supabase project must contain the `staff` and `bookings` tables and RLS policies from the supplied SQL.
2. `config.js` contains the Supabase Project URL and publishable key. Do not put a service-role/secret key in this file.
3. The owner account must exist in Supabase Auth and must be present in `public.staff`.
4. New accounts created in the website are created in Supabase Auth. For the private business workflow, the owner should authorize each new staff account by inserting their user ID into `public.staff`.
5. Host the folder on GitHub Pages (or another static host).

## Supabase email settings
If email confirmation is enabled, new users need to confirm their email before they can sign in. Set the Supabase Auth Site URL / redirect URLs to your GitHub Pages address after deployment.

## Important
The frontend uses only the publishable key. Keep the database password and service-role/secret keys private.
