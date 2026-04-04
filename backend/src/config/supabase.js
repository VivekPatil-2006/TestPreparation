const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

let supabaseAdmin = null;

if (env.supabaseUrl && env.supabaseServiceRoleKey) {
  supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

module.exports = {
  supabaseAdmin,
};
