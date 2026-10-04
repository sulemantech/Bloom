// Creates demo accounts for trying the app (safe to re-run). Development projects only.
// Usage (in apps/web): npm run seed:demo
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const COHORT_ID = "00000000-0000-0000-0000-000000001001"; // "Group 1" from seed.sql
const STUDENT = { username: "demo.student", password: "Demo-Student-2026", name: "Demo Student" };

async function ensureUser(email, fullName) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

async function setProfile(id, fields) {
  const { error } = await admin.from("profiles").update(fields).eq("id", id);
  if (error) throw error;
}

const adminId = await ensureUser("admin.demo@example.com", "Demo Admin");
await setProfile(adminId, { role: "admin", full_name: "Demo Admin" });

const mentorId = await ensureUser("mentor.demo@example.com", "Demo Mentor");
await setProfile(mentorId, { role: "mentor", full_name: "Demo Mentor" });

const parentId = await ensureUser("parent.demo@example.com", "Demo Parent");
await setProfile(parentId, { role: "parent", full_name: "Demo Parent" });

const studentEmail = `${STUDENT.username}@students.youthidealab.invalid`;
const studentId = await ensureUser(studentEmail, STUDENT.name);
await admin.auth.admin.updateUserById(studentId, { password: STUDENT.password });
await setProfile(studentId, {
  role: "student",
  username: STUDENT.username,
  full_name: STUDENT.name,
  birth_year: new Date().getFullYear() - 13,
});

await admin.from("guardian_links").upsert(
  { parent_id: parentId, student_id: studentId },
  { onConflict: "parent_id,student_id", ignoreDuplicates: true },
);
const { count: consents } = await admin
  .from("consents")
  .select("*", { count: "exact", head: true })
  .eq("student_id", studentId)
  .eq("type", "platform");
if (!consents) {
  await admin.from("consents").insert({ student_id: studentId, parent_id: parentId, type: "platform", version: "2026-10-v1" });
}
await admin.from("memberships").upsert(
  [
    { cohort_id: COHORT_ID, user_id: mentorId, role: "mentor" },
    { cohort_id: COHORT_ID, user_id: studentId, role: "student", age_group: "explorer" },
  ],
  { onConflict: "cohort_id,user_id", ignoreDuplicates: true },
);

console.log("Demo accounts ready:");
console.log("  admin    admin.demo@example.com   (sign in with: npm run login-link -- admin.demo@example.com)");
console.log("  mentor   mentor.demo@example.com  (in Group 1)");
console.log("  parent   parent.demo@example.com  (parent of demo.student)");
console.log(`  student  username ${STUDENT.username} / password ${STUDENT.password}  (Group 1, Explorer)`);
