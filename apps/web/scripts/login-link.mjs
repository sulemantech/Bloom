// Prints a one-time sign-in link for an existing account, without sending an email.
// For development only: anyone with the link can sign in as that user.
// Usage (in apps/web): npm run login-link -- parent.demo@example.com
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const site = process.env.SITE_URL ?? "http://localhost:3000";
if (!email) {
  console.error("Usage: npm run login-link -- <email>");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`${site}/auth/confirm?token_hash=${data.properties.hashed_token}&type=email`);
console.log("Works once and expires in 1 hour.");
