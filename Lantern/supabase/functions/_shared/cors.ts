// Both functions are called cross-origin from the Azure Static Web Apps
// frontend (a different origin than *.supabase.co), so the browser preflight
// (OPTIONS) needs an explicit allow -- the actual authz boundary is JWT
// verification (config.toml's verify_jwt) plus the case id being an
// unguessable UUID, not the request's origin.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
