// Exposes only the public Supabase URL + anon key to the browser. The anon key is public
// by design in Supabase's client model — security comes from RLS policies on the tables,
// never from treating this key as secret. Never add the service_role key here.
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return response.status(500).json({ error: 'Supabase environment variables are not configured' });
  }
  return response.status(200).json({ supabaseUrl, supabaseAnonKey });
}
