import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let queryError = null;
  let queryData = null;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('pedidos').select('id').limit(1);
    queryData = data;
    queryError = error;
  } catch (err) {
    queryError = err.message;
  }

  res.status(200).json({
    supabaseUrl,
    hasServiceRoleKey: !!supabaseKey,
    keyPrefix: supabaseKey ? supabaseKey.substring(0, 15) : null,
    keySuffix: supabaseKey ? supabaseKey.substring(supabaseKey.length - 5) : null,
    keyLength: supabaseKey ? supabaseKey.length : 0,
    queryError,
    queryData
  });
}
