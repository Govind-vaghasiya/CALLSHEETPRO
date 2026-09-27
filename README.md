# CALLSHEETPRO
Film and TV Production Scheduling app

Script → scene breakdown → cast & characters → stripboard schedule → call sheets, with
hour-by-hour availability, conflict checks, and schedule suggestions. Built with Next.js
and Supabase.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` (never commit it):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. Set up the database: in the Supabase dashboard → SQL Editor, run the files in
   `supabase/migrations/` in order (`001` … `021`).

4. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).
