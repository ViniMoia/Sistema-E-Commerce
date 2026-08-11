const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('Session').select('expiresAt, user:User(role, status)').limit(1)
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(console.error);
