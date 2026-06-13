import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env', 'utf-8');
const urlMatch = env.match(/SUPABASE_URL="(.*?)"/);
const keyMatch = env.match(/SUPABASE_PUBLISHABLE_KEY="(.*?)"/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const email = 'superadmin999@studysphere.com';
  const password = 'Admin@StudySphere!2026!XYZSecure!';
  
  console.log('Attempting to create admin account...');
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: 'Super Admin', role: 'admin' } }
  });
  
  if (error) {
    // If it already exists, let's just log in to check
    if (error.message.includes('already registered')) {
      console.log('Account already exists, trying to sign in...');
      const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) {
        console.error('Sign in error:', signErr.message);
        return;
      }
      checkRole(signData.user.id);
    } else {
      console.error('Signup Error:', error.message);
    }
    return;
  }
  
  console.log(`Successfully created!`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  
  await new Promise(r => setTimeout(r, 1000));
  checkRole(data.user.id);
}

async function checkRole(userId) {
  const { data: roleData, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  if (error) {
    console.error('Could not verify role (Your database might not have the migrations applied!):', error.message);
  } else {
    console.log('Current roles for this account in the database:', roleData);
  }
}

run();
