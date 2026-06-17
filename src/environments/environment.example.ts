// TEMPLATE — copy to `environment.ts` and fill in. The real file is gitignored.
// Production environment. supabaseUrl + supabaseAnonKey are client-safe (the
// anon key only grants what RLS allows). Privileged keys live in Edge Function
// secrets, never here.
export const environment = {
  production: true,
  supabaseUrl: 'https://<your-project-ref>.supabase.co',
  supabaseAnonKey: '<anon-public-key>',
};
