export default async function handler(req, res) {
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = !!process.env.VITE_SUPABASE_ANON_KEY;
  const hasSupabaseUrl = !!process.env.VITE_SUPABASE_URL;

  return res.status(200).json({
    hasServiceKey,
    anonKey,
    hasSupabaseUrl,
    hasDbUrl: !!process.env.DATABASE_URL,
    serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0,
    anonKeyLength: process.env.VITE_SUPABASE_ANON_KEY ? process.env.VITE_SUPABASE_ANON_KEY.length : 0,
    serviceKeyLast: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-5) : null,
    anonKeyLast: process.env.VITE_SUPABASE_ANON_KEY ? process.env.VITE_SUPABASE_ANON_KEY.slice(-5) : null
  });

}
