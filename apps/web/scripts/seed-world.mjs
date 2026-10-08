// Fills a development database with a realistic demo school (see scripts/demo-world/people.mjs):
// four groups in Lahore, Islamabad, Karachi and Peshawar, their mentors, students and parents, with
// several weeks of submissions, feedback, progress cards, classes, payments, Spark learning paths and
// AI usage. It builds on the demo logins from `npm run seed:demo`, which should run first.
//
//   npm run seed:world            local database (refuses anything else)
//   npm run seed:world -- --reset remove the demo school first, then create it again
//   npm run seed:world:online     the project in .env.local, for a public demo site (never real families)
//
// Everything is written with the service key, so the audit log honestly shows "System" as the actor.
// Timestamps are backdated so weeks, "last active" and overdue work look like a running course.
// Passwords: the existing DEMO_*_PASSWORD values are reused per role, if set; they are never printed.
import { createClient } from "@supabase/supabase-js";
import { COHORTS, DEMO_MENTOR_EXTRA_COHORTS, G1, MENTORS, PARENTS, STUDENTS } from "./demo-world/people.mjs";
import { cardFor, feedbackFor, FEELING_NOTES, first, PATHS, REVIEW, stepDetails, submissionFor } from "./demo-world/content.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const online = process.argv.includes("--online");
const reset = process.argv.includes("--reset");
if (!online && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
  console.error("Refusing to seed a non-local database. Use npm run seed:world:online for a demo project.");
  process.exit(1);
}
// Online, hundreds of sequential requests meet the odd dropped connection, which would stop the run
// half way. Network failures (not database errors, which come back as normal responses) are retried.
async function fetchWithRetry(input, init, attempt = 1) {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (attempt >= 5) throw error;
    console.warn(`Network error (${error.cause?.code ?? error.message}), retrying ${attempt}/4…`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return fetchWithRetry(input, init, attempt + 1);
  }
}
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false }, global: { fetch: fetchWithRetry } });

const PASSWORD = {
  mentor: process.env.DEMO_MENTOR_PASSWORD,
  parent: process.env.DEMO_PARENT_PASSWORD,
  student: process.env.DEMO_STUDENT_PASSWORD,
};
const STUDENT_DOMAIN = "students.youthidealab.invalid";
const studentEmail = (username) => `${username}@${STUDENT_DOMAIN}`;
const CONSENT_VERSION = "2026-10-v1";

const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

// Deterministic "random" numbers, so every run gives the same school.
let seed = 20261008;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const between = (lo, hi) => Math.round(lo + rand() * (hi - lo));
const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");

// ---------------------------------------------------------------------------
// Dates, in Pakistan time (UTC+5, no daylight saving). A "day" is the PK calendar day at 00:00 UTC.
// ---------------------------------------------------------------------------
const DAY = 86_400_000;
const pkNow = new Date(Date.now() + 5 * 3_600_000);
const today = Date.UTC(pkNow.getUTCFullYear(), pkNow.getUTCMonth(), pkNow.getUTCDate());
const lastWeekday = (wd) => today - ((new Date(today).getUTCDay() - wd + 7) % 7) * DAY;
const isoDate = (day) => new Date(day).toISOString().slice(0, 10);
/** A wall-clock time in Pakistan on `day`, as UTC ISO; never in the future. */
const at = (day, hhmm = "17:30") => {
  const [h, m] = hhmm.split(":").map(Number);
  const ms = Math.min(day + (h - 5) * 3_600_000 + m * 60_000, Date.now() - 2 * 3_600_000);
  return new Date(ms).toISOString();
};
const daysAgo = (n, hhmm) => at(today - n * DAY, hhmm);

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
const WORLD_EMAILS = new Set([
  ...MENTORS.map((m) => m.email),
  ...PARENTS.map((p) => p.email),
  ...STUDENTS.map((s) => studentEmail(s.username)),
]);

async function allUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const data = must(await db.auth.admin.listUsers({ page, perPage: 1000 }), "list users");
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function removeWorld() {
  const users = (await allUsers()).filter((u) => WORLD_EMAILS.has(u.email));
  for (const u of users) must(await db.auth.admin.deleteUser(u.id), `delete ${u.email}`);
  must(await db.from("cohorts").delete().in("id", COHORTS.filter((c) => c.id !== G1).map((c) => c.id)), "delete groups");
  console.log(`Removed ${users.length} demo people and the extra groups.`);
}

async function createUser({ email, name, role, username, password, age, prefersFemale, joinedDay }) {
  const data = must(
    await db.auth.admin.createUser({
      email,
      email_confirm: true,
      password: password || undefined,
      user_metadata: { full_name: name },
      app_metadata: { role, ...(username ? { username } : {}) },
    }),
    `create ${email}`,
  );
  const id = data.user.id;
  must(
    await db
      .from("profiles")
      .update({
        role,
        full_name: name,
        username: username ?? null,
        country: "PK",
        birth_year: age ? pkNow.getUTCFullYear() - age : null,
        prefers_female_mentor: Boolean(prefersFemale),
        created_at: at(joinedDay, "10:00"),
      })
      .eq("id", id),
    `profile ${email}`,
  );
  return id;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const existing = (await allUsers()).filter((u) => WORLD_EMAILS.has(u.email));
if (existing.length) {
  if (!reset) {
    console.log(`The demo school is already there (${existing.length} people). Run with --reset to recreate it.`);
    process.exit(0);
  }
  await removeWorld();
}

const users = await allUsers();
const demoMentor = users.find((u) => u.email === "mentor.demo@example.com");
const demoAdmin = users.find((u) => u.email === "admin.demo@example.com");
if (!demoMentor) {
  console.error("Run npm run seed:demo first: the demo school is built around the demo logins.");
  process.exit(1);
}

const program = must(await db.from("cohorts").select("program_id, organization_id, start_date, name").eq("id", G1).single(), "Group 1");

// Groups: dates so each one is in its own programme week today.
const groups = new Map();
for (const c of COHORTS) {
  let start;
  if (c.startDate) start = Date.parse(`${c.startDate}T00:00:00Z`);
  else if (c.id === G1 && program.start_date) start = Date.parse(`${program.start_date}T00:00:00Z`);
  else start = lastWeekday(c.schedule.weekday) - (c.week - 1) * 7 * DAY;
  const week = start > today ? 0 : Math.floor((today - start) / (7 * DAY)) + 1;
  const row = { id: c.id, organization_id: program.organization_id, program_id: program.program_id, name: c.name, start_date: isoDate(start), timezone: "Asia/Karachi", schedule: c.schedule };
  if (c.id === G1) {
    // Keep the existing group; only give it a real name and a start date.
    const fields = { start_date: row.start_date, schedule: c.schedule, ...(program.name === "Group 1" ? { name: c.name } : {}) };
    must(await db.from("cohorts").update(fields).eq("id", G1), "update Group 1");
  } else {
    must(await db.from("cohorts").insert({ ...row, created_at: at(start - 30 * DAY, "09:00") }), `group ${c.name}`);
  }
  groups.set(c.id, { ...c, start, week, mentors: [] });
}

// Activities of the programme, by week and age group.
const activities = must(
  await db.from("activities").select("id, week, position, age_group, title, stages!inner(program_id, key)").eq("stages.program_id", program.program_id),
  "activities",
).map((a) => ({ ...a, title: a.title.en, stage_key: a.stages.key }));
const activitiesFor = (group) => activities.filter((a) => a.age_group === null || a.age_group === group).sort((a, b) => a.week - b.week || a.position - b.position);
const activityByTitle = (title) => activities.find((a) => a.title === title);

// Mentors.
const mentorIds = new Map();
for (const m of MENTORS) {
  const id = await createUser({ email: m.email, name: m.name, role: "mentor", password: PASSWORD.mentor, joinedDay: today - 60 * DAY });
  mentorIds.set(m.key, id);
  for (const cohort of m.cohorts) {
    must(await db.from("memberships").insert({ cohort_id: cohort, user_id: id, role: "mentor", created_at: at(today - 45 * DAY, "10:00") }), "mentor membership");
    groups.get(cohort).mentors.push({ id, name: m.name });
  }
}
for (const cohort of DEMO_MENTOR_EXTRA_COHORTS) {
  must(await db.from("memberships").upsert({ cohort_id: cohort, user_id: demoMentor.id, role: "mentor" }, { onConflict: "cohort_id,user_id" }), "demo mentor membership");
  groups.get(cohort).mentors.push({ id: demoMentor.id, name: "Demo Mentor" });
}
groups.get(G1).mentors.push({ id: demoMentor.id, name: "Demo Mentor" });

// Parents.
const parentIds = new Map();
for (const p of PARENTS) {
  parentIds.set(p.key, await createUser({ email: p.email, name: p.name, role: "parent", password: PASSWORD.parent, joinedDay: today - between(20, 50) * DAY }));
}

// Students, their families, consents, payments and projects.
const studentRows = [];
for (const s of STUDENTS) {
  const group = s.cohort ? groups.get(s.cohort) : null;
  const joinedDay = group ? Math.min(group.start, today) - between(5, 15) * DAY : today - 1 * DAY;
  const id = await createUser({
    email: studentEmail(s.username), name: s.name, role: "student", username: s.username, password: PASSWORD.student,
    age: s.age, prefersFemale: s.prefersFemaleMentor, joinedDay,
  });
  const parentId = parentIds.get(s.parent);
  must(await db.from("guardian_links").insert({ parent_id: parentId, student_id: id, relationship: s.relationship, created_at: at(joinedDay, "10:05") }), "guardian link");
  for (const type of ["platform", ...s.consents]) {
    must(await db.from("consents").insert({ student_id: id, parent_id: parentId, type, version: CONSENT_VERSION, granted_at: at(joinedDay, "10:10") }), `consent ${type}`);
  }
  if (group) {
    must(
      await db.from("memberships").insert({
        cohort_id: group.id, user_id: id, role: "student", age_group: s.group,
        fee_amount: s.fee, discount_reason: s.discount ?? null,
        paid_at: s.paid ? at(joinedDay + 2 * DAY, "13:00") : null,
        created_at: at(joinedDay, "10:15"),
      }),
      "student membership",
    );
  }
  let projectId = null;
  if (group && s.project) {
    projectId = must(
      await db
        .from("projects")
        .insert({
          student_id: id, cohort_id: group.id, area: s.project.area, title: s.project.title, problem: s.project.problem,
          status: s.project.status, is_public: Boolean(s.public), created_at: at(group.start + 2 * DAY, "18:00"),
        })
        .select("id")
        .single(),
      "project",
    ).id;
  }
  // `group` is the cohort from here on; the age group (explorer / builder) stays as `ageGroup`.
  studentRows.push({ ...s, ageGroup: s.group, id, parentId, group, projectId });
}

// Classes: one per week, recorded once held; the next one has a join link.
for (const g of groups.values()) {
  const { count } = await db.from("sessions").select("*", { count: "exact", head: true }).eq("cohort_id", g.id);
  if (count) continue;
  const rows = [];
  for (let w = 1; w <= Math.max(g.week, 0) + 1 && w <= 8; w++) {
    const day = g.start + (w - 1) * 7 * DAY;
    const startsAt = new Date(day + (Number(g.schedule.start.slice(0, 2)) - 5) * 3_600_000).toISOString();
    const held = Date.parse(startsAt) < Date.now();
    rows.push({
      cohort_id: g.id, starts_at: startsAt, title: `Week ${w} — live class`,
      recording_url: held ? `https://example.com/recordings/${g.id.slice(-4)}-week-${w}` : null,
      join_url: held ? null : "https://meet.google.com/demo-class",
    });
  }
  if (rows.length) must(await db.from("sessions").insert(rows), "sessions");
}

// ---------------------------------------------------------------------------
// Course work: submissions and feedback by pattern
// ---------------------------------------------------------------------------
const OFFSET = { star: 2, steady: 4, stuck: 5, behind: 6, quiet: 1 };
let reviews = 0;
for (const s of studentRows) {
  const g = s.group;
  if (!g || g.week < 1 || s.pattern === "new") continue;
  const W = g.week;
  for (const [i, a] of activitiesFor(s.ageGroup).entries()) {
    if (a.week > W) break;
    let status = null;
    if (a.week < W) {
      if (s.pattern === "star") status = "done";
      else if (s.pattern === "steady") status = a.week === W - 1 ? "submitted" : "done";
      else if (s.pattern === "stuck") status = a.week === W - 1 ? "submitted" : i % 2 ? "needs_changes" : "done";
      else if (s.pattern === "behind") status = a.week === 1 && W > 2 ? "done" : null;
      else if (s.pattern === "quiet") status = a.week === 1 || (a.week === 2 && W > 3) ? "done" : null;
    } else if (s.pattern === "star" && a.position === 1) status = "submitted";
    if (!status) continue;
    const work = submissionFor(a.title, s);
    if (!work) continue;
    const day = g.start + (a.week - 1) * 7 * DAY + OFFSET[s.pattern] * DAY;
    const submittedAt = at(Math.min(day, today), "17:30");
    const sub = must(
      await db
        .from("submissions")
        .insert({ activity_id: a.id, student_id: s.id, cohort_id: g.id, project_id: s.projectId, body: work.body, link_url: work.link_url, status, submitted_at: submittedAt })
        .select("id")
        .single(),
      "submission",
    );
    if (status !== "submitted") {
      const mentor = g.mentors[reviews++ % g.mentors.length];
      must(
        await db.from("feedback").insert({
          submission_id: sub.id, mentor_id: mentor.id, body: feedbackFor(status, a.title, s, reviews),
          created_at: at(Math.min(day + DAY, today), "20:15"),
        }),
        "feedback",
      );
    }
  }
}

// Progress cards: approved for each finished week, read by parents who sign in; this week's in draft.
for (const s of studentRows) {
  const g = s.group;
  if (!g || g.week < 2 || s.pattern === "new") continue;
  const parent = PARENTS.find((p) => p.key === s.parent);
  for (let w = 1; w < g.week; w++) {
    const approvedDay = Math.min(g.start + w * 7 * DAY - DAY, today);
    const mentor = g.mentors[w % g.mentors.length];
    const card = must(
      await db.from("progress_cards").insert({ student_id: s.id, cohort_id: g.id, week: w, body: cardFor(s, w, s.pattern), status: "approved" }).select("id").single(),
      "card",
    );
    // The approval trigger stamps the service key (no user); record the mentor who would have approved it.
    must(
      await db
        .from("progress_cards")
        .update({ approved_by: mentor.id, approved_at: at(approvedDay, "19:00"), viewed_at: parent.neverSignedIn ? null : at(Math.min(approvedDay + DAY, today), "21:30") })
        .eq("id", card.id),
      "card approval",
    );
  }
  if (s.pattern === "star" || s.pattern === "steady") {
    must(await db.from("progress_cards").insert({ student_id: s.id, cohort_id: g.id, week: g.week, body: cardFor(s, g.week, s.pattern), status: "draft" }), "draft card");
  }
}

// ---------------------------------------------------------------------------
// Spark: learning paths with checks, reviews, feelings and the learner state they lead to
// ---------------------------------------------------------------------------
// steps: per finished step, the feeling and a verdict per check question (in order).
const SPARK = {
  "zainab.hussain": [{ path: "questions", anchor: "My three idea seeds", started: 6, steps: [["just_right", ["nailed", "nailed"]], ["too_easy", ["nailed", "nailed"]]] }],
  "ali.raza": [{ path: "questions", anchor: "My three idea seeds", started: 4, steps: [["just_right", ["nailed", "nearly"]]], doing: true }],
  "maryam.javed": [{ path: "questions", anchor: "What do you enjoy?", started: 8, steps: [["too_hard", ["nearly", "not_yet"]], ["too_hard", ["nearly", "not_yet"]]] }],
  "ayaan.sheikh": [{ path: "questions", anchor: "stage", started: 11, steps: [] }],
  "eshaal.chaudhry": [
    { path: "statement", anchor: "Pick one real problem", started: 15, steps: [["just_right", ["nailed", "nailed"]], ["too_easy", ["nailed"]], ["just_right", []]] },
    { path: "screen", anchor: "project", started: 3, steps: [["just_right", ["nailed", "nailed"]]] },
  ],
  "rayyan.butt": [{ path: "pricing", anchor: "project", started: 6, steps: [["just_right", ["nailed", "nearly"]]] }],
  "laiba.akhtar": [{ path: "screen", anchor: "Plan your solution", started: 7, steps: [["too_hard", ["not_yet", "nearly"]], ["too_hard", ["nearly", "not_yet"]]] }],
  "abdullah.mirza": [{ path: "statement", anchor: "Pick one real problem", started: 13, steps: [["just_right", ["nearly", "nailed"]]] }],
  "areeba.khan": [
    { path: "pricing", anchor: "project", started: 20, steps: [["too_easy", ["nailed", "nailed"]], ["just_right", ["nailed"]], ["just_right", []]] },
    { path: "testing", anchor: "Test with real users", started: 4, steps: [["just_right", ["nailed", "nailed"]]], doing: true },
  ],
  "daniyal.memon": [{ path: "testing", anchor: "Test with real users", started: 5, steps: [["just_right", ["nailed", "nearly"]]] }],
  "fatima.noor": [{ path: "screen", anchor: "Build sprint: working prototype", started: 9, steps: [["too_hard", ["nearly", "not_yet"]], ["just_right", ["not_yet", "nearly"]]] }],
  "omar.farooq": [{ path: "statement", anchor: "project", started: 14, steps: [["just_right", ["nailed", "nearly"]]] }],
};

const conceptKey = (label) => label.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const aiRuns = [];

for (const s of studentRows) {
  const plans = SPARK[s.username];
  if (!plans || !s.group) continue;
  const concepts = new Map();
  for (const plan of plans) {
    const tpl = PATHS[plan.path];
    const g = s.group;
    const startedDay = today - plan.started * DAY;
    let anchor;
    if (plan.anchor === "project") anchor = { anchor_kind: "project", anchor_label: s.project.problem ?? s.project.title };
    else if (plan.anchor === "stage") anchor = { anchor_kind: "stage", anchor_label: "Explore" };
    else {
      const a = activityByTitle(plan.anchor);
      anchor = { anchor_kind: "activity", anchor_label: a.title, anchor_activity_id: a.id, anchor_week: a.week };
    }
    const path = must(
      await db
        .from("bloom_paths")
        .insert({
          student_id: s.id, cohort_id: g.id, title: tpl.title, goal: tpl.goal, summary: tpl.summary, depth: "quick",
          stage_key: activities.find((a) => a.week === Math.max(g.week, 1))?.stage_key ?? "explore", ai_generated: true,
          created_at: at(startedDay, "16:00"), ...anchor,
        })
        .select("id")
        .single(),
      "path",
    );
    aiRuns.push({ capability: "bloom_suggest", student_id: s.id, actor_id: s.id, at: at(startedDay, "15:58"), size: "suggest" });
    aiRuns.push({ capability: "bloom_plan", student_id: s.id, actor_id: s.id, at: at(startedDay, "16:00"), size: "plan" });

    let previous = null;
    for (const [i, step] of tpl.steps.entries()) {
      const finished = plan.steps[i];
      const isCurrent = !finished && i === plan.steps.length;
      const doneDay = startedDay + (i + 1) * Math.max(1, Math.floor(plan.started / (plan.steps.length + 1))) * DAY;
      const checks = step.checks.map((c, ci) => ({
        kind: c.kind, question: c.question, idea: c.idea,
        // A re-check: the idea was missed on the step before (lib/bloom/gaps).
        recheck: Boolean(previous?.missed.includes(c.idea)) && ci === step.checks.findIndex((x) => previous.missed.includes(x.idea)),
      }));
      const verdicts = finished?.[1] ?? [];
      const answers = verdicts.map((v, vi) => (v === "nailed" ? step.checks[vi].good : step.checks[vi].weak));
      const review = verdicts.length ? verdicts.map((v, vi) => REVIEW[v](step.checks[vi])) : null;
      const adapted = previous && (previous.feeling === "too_hard" || previous.missed.length);
      const task = must(
        await db
          .from("bloom_tasks")
          .insert({
            path_id: path.id, student_id: s.id, position: i + 1, kind: step.kind, title: step.title, details: stepDetails(step),
            status: finished ? "done" : isCurrent && plan.doing ? "doing" : "todo",
            feeling: finished?.[0] ?? null,
            reflection: finished ? FEELING_NOTES[finished[0]] : null,
            planned_only: false,
            adaptation: adapted ? "You found the last step hard, so this one uses a fresh example and checks that idea again." : null,
            adapted_from: adapted ? previous.id : null,
            difficulty: i === 0 ? "same" : previous?.feeling === "too_hard" ? "easier" : previous?.feeling === "too_easy" ? "harder" : "same",
            check_questions: checks,
            check_answers: verdicts.length ? answers : null,
            check_review: review,
          })
          .select("id")
          .single(),
        "step",
      );
      if (finished) {
        must(await db.from("bloom_tasks").update({ completed_at: at(Math.min(doneDay, today), "19:30") }).eq("id", task.id), "step date");
        if (i + 1 < tpl.steps.length) aiRuns.push({ capability: "bloom_step", student_id: s.id, actor_id: s.id, at: at(Math.min(doneDay, today), "19:31"), size: "step" });
        // Learner state: nailed → understood; nearly / not yet → struggling (lib/bloom/learner applyReview).
        verdicts.forEach((v, vi) => {
          const label = step.checks[vi].idea;
          const c = concepts.get(conceptKey(label)) ?? { key: conceptKey(label), label, status: "understood", struggle_count: 0, nailed_count: 0 };
          if (v === "nailed") Object.assign(c, { status: "understood", nailed_count: c.nailed_count + 1 });
          else Object.assign(c, { status: "struggling", struggle_count: c.struggle_count + 1 });
          concepts.set(c.key, { ...c, last_path_id: path.id, last_task_id: task.id, at: at(Math.min(doneDay, today), "19:30") });
        });
      }
      previous = {
        id: task.id,
        feeling: finished?.[0],
        missed: verdicts.flatMap((v, vi) => (v !== "nailed" ? [step.checks[vi].idea] : [])),
      };
    }
    // Path dates follow its steps (the triggers stamped "now").
    const { data: done } = await db.from("bloom_tasks").select("status, completed_at").eq("path_id", path.id);
    if (done.every((t) => t.status === "done")) {
      const last = done.map((t) => t.completed_at).sort().at(-1);
      must(await db.from("bloom_paths").update({ completed_at: last }).eq("id", path.id), "path date");
    }
  }
  if (concepts.size) {
    must(
      await db.from("spark_concepts").insert(
        [...concepts.values()].map(({ at: when, ...c }) => ({ student_id: s.id, ...c, created_at: when, updated_at: when })),
      ),
      "concepts",
    );
  }
}

// A few questions students asked Spark while learning.
const asked = [
  ["zainab.hussain", "Can I ask my cousins on WhatsApp instead of in person?", "Yes — a voice note works well. Ask the same open questions and write down their exact words."],
  ["areeba.khan", "Should Hisaab show money in rupees or as a percentage of the week?", "Show rupees first — that's what teens think in — and a small bar for how much of the week is left."],
  ["maryam.javed", "What is the difference between a leading question and a normal one?", "A leading question hints at the answer you want, like 'Don't you think…?'. A normal open question lets them decide."],
];
for (const [username, question, answer] of asked) {
  const s = studentRows.find((x) => x.username === username);
  const { data: path } = await db.from("bloom_paths").select("id").eq("student_id", s.id).order("created_at", { ascending: false }).limit(1).single();
  must(await db.from("bloom_questions").insert({ path_id: path.id, student_id: s.id, question, answer, created_at: daysAgo(between(1, 3), "20:10") }), "question");
  aiRuns.push({ capability: "bloom_ask", student_id: s.id, actor_id: s.id, at: daysAgo(between(1, 3), "20:10"), size: "ask" });
}

// AI usage: what the above would have cost, plus mentors' progress-card drafts and a few refusals.
for (const s of studentRows.filter((x) => x.group && x.group.week >= 2 && x.consents.includes("ai"))) {
  for (let w = 1; w < s.group.week; w++) {
    if (rand() < 0.6) aiRuns.push({ capability: "progress_card", student_id: s.id, actor_id: s.group.mentors[0].id, at: at(Math.min(s.group.start + w * 7 * DAY - DAY, today), "18:45"), size: "card" });
  }
}
const hassan = studentRows.find((s) => s.username === "hassan.abbasi");
aiRuns.push({ capability: "progress_card", student_id: hassan.id, actor_id: hassan.group.mentors[0].id, at: daysAgo(2, "18:40"), outcome: "no_consent" });
const maryam = studentRows.find((s) => s.username === "maryam.javed");
aiRuns.push({ capability: "bloom_step", student_id: maryam.id, actor_id: maryam.id, at: daysAgo(1, "22:05"), outcome: "limited" });
const SIZE = { suggest: [1800, 700], plan: [2600, 1900], step: [3600, 1400], ask: [900, 320], card: [1300, 380] };
must(
  await db.from("ai_runs").insert(
    aiRuns.map((r) => {
      const ok = !r.outcome || r.outcome === "ok";
      const [inTok, outTok] = SIZE[r.size] ?? [0, 0];
      return {
        capability: r.capability, student_id: r.student_id, actor_id: r.actor_id, model: ok ? "claude-opus-5-5" : null,
        input_tokens: ok ? between(inTok * 0.8, inTok * 1.2) : null, output_tokens: ok ? between(outTok * 0.8, outTok * 1.2) : null,
        latency_ms: ok ? between(4000, 14000) : null, outcome: r.outcome ?? "ok", input_hash: hex(16), created_at: r.at,
      };
    }),
  ),
  "ai runs",
);

// Backdate Spark activity. The database stamps updated_at (and a finished step's completed_at) with
// "now" on every write, which would make every Spark student look active today. Locally, one SQL
// statement as the database owner restores the dates the steps really have, with triggers skipped.
if (!online) {
  const { execFileSync } = await import("node:child_process");
  const { readFileSync } = await import("node:fs");
  const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(new URL("../../../supabase/config.toml", import.meta.url), "utf8"))?.[1];
  const ids = studentRows.map((s) => `'${s.id}'`).join(",");
  const sql = `begin;
set local session_replication_role = replica;
update public.bloom_tasks t set created_at = p.created_at, updated_at = coalesce(t.completed_at, p.created_at)
  from public.bloom_paths p where p.id = t.path_id and t.student_id in (${ids});
update public.bloom_paths set updated_at = coalesce(completed_at, created_at) where student_id in (${ids});
update public.projects set updated_at = created_at where student_id in (${ids});
commit;`;
  try {
    execFileSync("docker", ["exec", "-i", `supabase_db_${projectId}`, "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"], { input: sql, stdio: ["pipe", "ignore", "inherit"] });
  } catch {
    console.warn("Could not backdate Spark activity through Docker; those students will show as active today.");
  }
}

// Adults sign in once, so "never signed in" only flags the two parents who really haven't.
let signedIn = 0;
if (PASSWORD.mentor && PASSWORD.parent) {
  const anon = () => createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false }, global: { fetch: fetchWithRetry } });
  for (const m of MENTORS) if (!(await anon().auth.signInWithPassword({ email: m.email, password: PASSWORD.mentor })).error) signedIn++;
  for (const p of PARENTS.filter((p) => !p.neverSignedIn)) if (!(await anon().auth.signInWithPassword({ email: p.email, password: PASSWORD.parent })).error) signedIn++;
}

console.log("Demo school ready:");
for (const g of groups.values()) {
  const count = studentRows.filter((s) => s.group?.id === g.id).length;
  console.log(`  ${g.name.padEnd(34)} ${g.week ? `week ${g.week}` : "not started"} · ${count} new students · mentors: ${g.mentors.map((m) => m.name).join(", ") || "none yet"}`);
}
console.log(`  ${studentRows.filter((s) => !s.group).length} student not in a group yet · ${PARENTS.length} parents · ${aiRuns.length} AI runs · ${signedIn} adults signed in once`);
console.log(`Sign in as any of them with the role's demo password (students by username, e.g. ${STUDENTS[0].username}).`);
if (demoAdmin) console.log("Admin: admin.demo@example.com");
