// Creates demo accounts for trying the app (safe to re-run). Development projects only.
// Usage (in apps/web): npm run seed:demo
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const COHORT_ID = "00000000-0000-0000-0000-000000001001"; // "Group 1" from seed.sql
// Passwords come from .env.local (never committed): DEMO_STUDENT_PASSWORD, DEMO_ADMIN_PASSWORD,
// DEMO_MENTOR_PASSWORD, DEMO_PARENT_PASSWORD.
const env = (name) => {
  const value = process.env[name];
  if (!value || value.length < 8) throw new Error(`Set ${name} (8+ characters) in .env.local`);
  return value;
};

const STUDENT = { username: "demo.student", password: env("DEMO_STUDENT_PASSWORD"), name: "Demo Student" };

// Development only: adults normally sign in with an email link (ENABLE_DEV_PASSWORD_LOGIN enables passwords).
const ADULT_PASSWORDS = {
  "admin.demo@example.com": env("DEMO_ADMIN_PASSWORD"),
  "mentor.demo@example.com": env("DEMO_MENTOR_PASSWORD"),
  "parent.demo@example.com": env("DEMO_PARENT_PASSWORD"),
};

async function ensureUser(email, fullName) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    if (ADULT_PASSWORDS[email]) await admin.auth.admin.updateUserById(existing.id, { password: ADULT_PASSWORDS[email] });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: ADULT_PASSWORDS[email],
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

// Demo group: started on the Saturday before last (so it's in week 2), with classes and AI consent.
const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
const lastSaturday = new Date(today);
lastSaturday.setDate(today.getDate() - ((today.getDay() + 1) % 7));
const start = new Date(lastSaturday);
start.setDate(lastSaturday.getDate() - 7);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
await admin.from("cohorts").update({ start_date: iso(start) }).eq("id", COHORT_ID).is("start_date", null);

const { count: sessionCount } = await admin.from("sessions").select("*", { count: "exact", head: true }).eq("cohort_id", COHORT_ID);
if (!sessionCount) {
  const at = (d) => `${iso(d)}T06:00:00Z`; // 11:00 in Pakistan
  const nextSaturday = new Date(lastSaturday);
  nextSaturday.setDate(lastSaturday.getDate() + 7);
  await admin.from("sessions").insert([
    { cohort_id: COHORT_ID, starts_at: at(start), title: "Week 1 — Explore", recording_url: "https://example.com/recordings/week-1" },
    { cohort_id: COHORT_ID, starts_at: at(lastSaturday), title: "Week 2 — Try two areas", recording_url: "https://example.com/recordings/week-2" },
    { cohort_id: COHORT_ID, starts_at: at(nextSaturday), title: "Week 3 — Choose your problem", join_url: "https://zoom.us/j/0000000000" },
  ]);
}

// AI consents: mentors' progress-card drafts ("ai") and the student's Bloom guide ("bloom_ai").
for (const type of ["ai", "bloom_ai"]) {
  const { count } = await admin
    .from("consents")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("type", type)
    .is("revoked_at", null);
  if (!count) {
    await admin.from("consents").insert({ student_id: studentId, parent_id: parentId, type, version: "2026-10-v1" });
  }
}

// One Bloom learning path, half done, so every role has something to look at.
const { count: bloomCount } = await admin.from("bloom_paths").select("*", { count: "exact", head: true }).eq("student_id", studentId);
if (!bloomCount) {
  const { data: path, error: pathError } = await admin
    .from("bloom_paths")
    .insert({
      student_id: studentId,
      cohort_id: COHORT_ID,
      title: "Talking to people about a problem",
      goal: "Ask good questions and find out what people really need",
      summary: "Great projects start with listening. In this path you'll learn how to ask open questions, try them on two people, and turn what you hear into a clear problem statement.",
      stage_key: "explore",
      // Every path serves a real need (roadmap 2.5.4): this one, the programme step.
      anchor_kind: "stage",
      anchor_label: "Explore",
      ai_generated: true,
    })
    .select("id")
    .single();
  if (pathError) throw pathError;
  // Bulk inserts need the same keys on every row (missing keys become null).
  const { error: taskError } = await admin.from("bloom_tasks").insert([
    { path_id: path.id, student_id: studentId, position: 1, kind: "learn", status: "done", title: "What makes a good question?", details: "Open questions start with how, what or why and can't be answered with yes or no. Write 3 closed questions, then rewrite each as an open one.", reflection: "\"Do you like school lunch?\" became \"What's the hardest part of lunchtime?\" — much better answers!" },
    { path_id: path.id, student_id: studentId, position: 2, kind: "do", status: "doing", reflection: null, title: "Interview two people", details: "Ask a family member and a friend your 3 open questions about a problem you've noticed. Write down their exact words, not your summary." },
    { path_id: path.id, student_id: studentId, position: 3, kind: "reflect", status: "todo", reflection: null, title: "What surprised you?", details: "Compare the two interviews. What did both people say? What surprised you? Write one sentence: \"[Who] struggles with [what] because [why].\"" },
  ]);
  if (taskError) throw taskError;
}
await admin
  .from("memberships")
  .update({ fee_amount: 15000, paid_at: new Date().toISOString() })
  .eq("cohort_id", COHORT_ID)
  .eq("user_id", studentId)
  .is("paid_at", null);

console.log("Demo accounts ready:");
for (const [email, password] of Object.entries(ADULT_PASSWORDS)) {
  console.log(`  ${email.split(".")[0].padEnd(8)} ${email} / password ${password}`);
}
console.log(`  student  username ${STUDENT.username} / password ${STUDENT.password}  (Group 1, Explorer)`);
