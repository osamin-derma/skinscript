import { createClient } from '@supabase/supabase-js'

// Project credentials for SkinScript on Supabase.
//
// The `publishable` key (new-format equivalent of the legacy `anon` JWT) is
// safe to embed in frontend code — it grants only the privileges allowed by
// Row-Level Security on each table.  Never put the `secret` / `service_role`
// key in this file.
const SUPABASE_URL = 'https://yssrtjfgkctojkzcoapt.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_theLFPKxFtPkchJ9bk6HFA_p78CuBAu'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,           // keep session in localStorage
    autoRefreshToken: true,         // rotate access token before expiry
    detectSessionInUrl: true,       // pick up email-confirm / reset-password redirects
  },
})
