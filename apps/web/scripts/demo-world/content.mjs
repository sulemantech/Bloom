// What the demo students write, what mentors answer, and the Spark paths they follow.
// Written to read like real work from 12-18 year olds in Pakistan: short, specific, a little rough.

const first = (s) => s.name.split(" ")[0] === "Muhammad" ? s.name.split(" ")[1] : s.name.split(" ")[0];
export { first };

/** A submission for one activity (by its English title), from the student's story. */
export function submissionFor(title, s) {
  const st = s.story;
  const lines = {
    "What do you enjoy?": () =>
      `I enjoy ${st.enjoy}.\n\nProblems I notice:\n1. ${st.problems[0]}\n2. ${st.problems[1]}\n3. ${st.problems[2]}`,
    "Design challenge in Canva": () =>
      ({ body: `I made a poster for ${st.ideas[1] ? st.ideas[1].split(",")[0].toLowerCase() : "a club I want to start"}. I used two colours and big text so it can be read from far.`, link_url: `https://www.canva.com/design/demo-${s.username}/view` }),
    "Redesign something you use": () =>
      ({ body: `I picked ${st.redesign}`, link_url: `https://www.figma.com/file/demo-${s.username}` }),
    "Try two project areas": () =>
      ({ body: `I tried ${st.areas}. I made ${st.made}. I enjoyed ${st.favourite} more because I could see people actually using it.`, link_url: `https://drive.google.com/demo-${s.username}-mini-tasks` }),
    "My three idea seeds": () =>
      `1. ${st.ideas[0]}\n2. ${st.ideas[1]}\n3. ${st.ideas[2]}\n\nI like the first one most because I see this problem every day.`,
    "Pick one real problem": () =>
      `My problem: ${s.project?.problem ?? st.problems[0]}\nWho has it: ${st.who}.\nWhy it matters: it happens every week and nobody is fixing it.`,
    "Talk to 3 people": () => `${st.interviews}\nWhat surprised me: people already have the problem but never talk about it.`,
    "Interview 10 real users": () =>
      `${st.interviews}\n\nThree patterns:\n1. Most people notice the problem every week.\n2. Nobody uses a tool for it now.\n3. They want something simple on their phone.`,
    "Plan your solution": () =>
      ({ body: `I will build ${st.build}. It is for ${st.who}. The first screen shows the one thing they need most. Sketch attached.`, link_url: `https://drive.google.com/demo-${s.username}-sketch` }),
    "Build sprint: first version": () => ({ body: `First version is ready in ${st.tool}. It has the main page and one example.`, link_url: `https://${st.slug}.demo.example.com` }),
    "Build sprint: working prototype": () =>
      ({ body: `Working: the main flow in ${st.tool}. Not yet: saving history and the share button.`, link_url: `https://${st.slug}.demo.example.com` }),
    "Test with real users": () =>
      `I showed it to 4 people. They liked that it is quick. Two got stuck on the first button because the label was unclear. I will rename it and make it bigger.`,
    "Improve it": () => ({ body: `Renamed the first button and made the text bigger. Added a short help line at the top.`, link_url: `https://${st.slug}.demo.example.com/v2` }),
  };
  const make = lines[title];
  if (!make) return null;
  const out = make();
  return typeof out === "string" ? { body: out, link_url: null } : out;
}

/** Mentor feedback on a submission. */
export function feedbackFor(status, title, s, i) {
  const name = first(s);
  const done = [
    `Lovely work, ${name}. Your examples are specific — that is exactly what makes "${title}" strong.`,
    `Well done ${name}! Clear and honest. Keep this level of detail next week.`,
    `Great job. I can tell you really thought about who has this problem.`,
    `Shabash ${name}! This is ready. Bring it to Saturday's class so others can see.`,
  ];
  const changes = [
    `Good start, ${name}. Can you add who exactly has each problem (age, where they are)? Then resubmit.`,
    `Nearly there. Please add one real example from someone you spoke to, not a guess.`,
    `Thanks ${name}. The idea is good but too broad — pick one group of people and rewrite it for them.`,
  ];
  const list = status === "done" ? done : changes;
  return list[i % list.length];
}

/** A weekly progress card a mentor approved for the parent. */
export function cardFor(s, week, pattern) {
  const name = first(s);
  if (pattern === "behind")
    return `${name} joined the live class this week but hasn't submitted the week ${week} activities yet. They are short tasks — 20 minutes each. Please help ${name} set aside one evening to catch up; I'm happy to help on WhatsApp through the group.`;
  if (pattern === "quiet")
    return `${name} made a good start in week 1. We haven't seen ${name} in class or on the platform since. Could you check in at home? Missing one more week makes the project harder to choose.`;
  if (pattern === "stuck")
    return `${name} worked hard this week and submitted everything. Some ideas take practice — ${name} is working on asking questions that don't push people to an answer. A good home activity: ask ${name} to interview you about your day using "what" and "how" questions.`;
  return `${name} had a strong week ${week}. The work was specific and honest, especially about who has the problem. Next week is about talking to real people — please encourage ${name} to speak to two family members or neighbours about it.`;
}

// ---------------------------------------------------------------------------
// Spark paths: a small library. Each question has a strong and a weak answer and the review for each.
// ---------------------------------------------------------------------------

const q = (kind, idea, question, good, weak, key) => ({ kind, idea, question, good, weak, key });

export const PATHS = {
  questions: {
    title: "Asking questions that get real answers",
    goal: "Talk to people about a problem without pushing them towards my idea",
    summary: "Good projects start with listening. You'll learn to ask open questions, spot leading ones, and follow up so people tell you what really happens.",
    steps: [
      {
        kind: "learn", title: "Open and closed questions", minutes: 15,
        intro: "A closed question gets a yes or no. An open question lets people tell you their story, which is where the real problem hides.",
        example: '"Do you like the school van?" is closed. "What is the school van like for you?" is open.',
        actions: ["Write 3 questions you might ask about your problem", "Mark each one open or closed", "Rewrite every closed one so it starts with what, how or why"],
        checks: [
          q("apply", "open questions", "Your cousin says the canteen is fine. What open question could you ask next?", "What happens at the canteen on a busy day?", "Is the canteen good?", "An open question starts with what or how and invites a story."),
          q("judge", "leading questions", 'Which is better and why: "Don\'t you hate the long queue?" or "Tell me about break time."', "The second, because the first tells them what to feel.", "The first, because it is about the problem.", "A leading question pushes people towards the answer you want, so you learn nothing new."),
        ],
      },
      {
        kind: "do", title: "Try your questions on two people", minutes: 25,
        intro: "Now ask two real people. Write their exact words, not your summary.",
        example: "Ask your ammi and a friend the same 3 open questions.",
        actions: ["Pick two people who have the problem", "Ask your 3 open questions", "Write down their exact words", "Underline anything that surprised you"],
        checks: [
          q("apply", "follow-up questions", 'Someone says "it\'s annoying". What could you ask to learn more?', "What happened the last time it annoyed you?", "Why?", "A good follow-up asks for a real, recent example."),
          q("judge", "leading questions", 'Is "Wouldn\'t an app fix this?" a good interview question?', "No — it suggests my solution, so they will just agree.", "Yes, because it asks about my idea.", "Asking about your own solution too early leads people to agree politely."),
        ],
      },
      { kind: "reflect", title: "What did you learn about your problem?", minutes: 10, intro: "Compare the two conversations and write one sentence: [Who] struggles with [what] because [why].", actions: ["Read both sets of notes", "Write what both people said", "Write your one sentence"], checks: [] },
    ],
  },
  statement: {
    title: "From idea to a clear problem statement",
    goal: "Write one sentence that says who has the problem, what it is and why it matters",
    summary: "A clear problem statement keeps your whole project on track. You'll practise naming the user, the problem and the cause.",
    steps: [
      {
        kind: "learn", title: "Who, what and why", minutes: 15,
        intro: "A problem statement has three parts: who has the problem, what goes wrong, and why it happens.",
        example: "Junior students (who) miss lunch (what) because the canteen queue takes the whole break (why).",
        actions: ["Read the example", "Underline the who, what and why", "Write your own version"],
        checks: [
          q("apply", "target user", 'Make this more specific: "People don\'t save water."', "Students at my school leave taps running during wudu.", "People should save water.", "A target user is a specific group you could actually talk to."),
          q("judge", "problem statement", 'Is "We need an app for the canteen" a problem statement?', "No, it is a solution. The problem is students missing lunch.", "Yes, it says what we need.", "A problem statement describes the pain, not your solution."),
        ],
      },
      {
        kind: "do", title: "Find the root cause", minutes: 20,
        intro: "Ask 'why?' three times to get from what people see to why it really happens.",
        example: "Why do students miss lunch? The queue is long. Why? Orders are made one by one. Why? The canteen doesn't know orders in advance.",
        actions: ["Write your problem at the top", "Ask why three times", "Circle the cause you could change"],
        checks: [q("judge", "root cause", "Why is finding the root cause useful before building?", "Because fixing the cause stops the problem, not just one symptom.", "So the project looks bigger.", "The root cause is the reason behind the problem; fixing it lasts.")],
      },
      { kind: "reflect", title: "Your final statement", minutes: 10, intro: "Write your final problem statement and share it with your mentor.", actions: ["Write it in one sentence", "Read it to someone at home", "Change any word they didn't understand"], checks: [] },
    ],
  },
  pricing: {
    title: "Pricing your first product",
    goal: "Set a price that covers my costs and that my customers will pay",
    summary: "Price too high and nobody buys; too low and you lose money. You'll work out your unit cost, a fair margin and what others charge.",
    steps: [
      {
        kind: "learn", title: "What does one unit cost you?", minutes: 15,
        intro: "Unit cost is everything you spend to make one item.",
        example: "One lemonade: lemons Rs 20 + sugar Rs 5 + cup Rs 10 = Rs 35.",
        actions: ["List everything you need for one item", "Write the price of each", "Add them up"],
        checks: [
          q("apply", "unit cost", "A pre-order slip costs Rs 2 to print and Rs 1 for a pen share. What is the unit cost?", "Rs 3 per slip.", "Rs 2.", "Add every cost that goes into one item."),
          q("judge", "profit margin", "You sell at Rs 50 and it costs Rs 35. Is that a good margin?", "Rs 15 profit, 30% — fine for a school stall.", "Yes because it sells.", "Margin is price minus cost, often as a percentage of the price."),
        ],
      },
      {
        kind: "do", title: "Check what others charge", minutes: 20,
        intro: "Look at 3 similar products and their prices before you decide.",
        actions: ["Find 3 similar products", "Write their prices", "Choose your price and one reason"],
        checks: [q("judge", "competitor prices", "Others charge Rs 40 and Rs 60. Where would you price and why?", "Rs 50, a bit better quality than the Rs 40 one.", "Rs 100 so I earn more.", "Compare with others so customers see your price as fair.")],
      },
      { kind: "reflect", title: "Your price and why", minutes: 10, intro: "Write your price, your margin and why customers will pay it.", actions: ["Write the price", "Write the margin", "Write one reason"], checks: [] },
    ],
  },
  testing: {
    title: "Testing with real users",
    goal: "Watch real people use my project and learn what to fix",
    summary: "The best way to improve is to watch someone use your project without helping them. You'll plan a short test and find patterns.",
    steps: [
      {
        kind: "learn", title: "Watch, don't tell", minutes: 15,
        intro: "In a usability test you give someone a task and watch quietly. Where they get stuck is your to-do list.",
        example: '"Add today\'s spending" — then watch without pointing at the screen.',
        actions: ["Write 2 tasks a user should do", "Plan to stay quiet while they try", "Prepare a notes table: task, stuck?, what they said"],
        checks: [
          q("apply", "usability test", "Your friend can't find the save button. What do you do?", "Stay quiet, note where they looked, ask afterwards what they expected.", "Show them where it is.", "Helping hides the problem; watching shows it."),
          q("judge", "observing not telling", 'Why is "Is it easy to use?" a weak test question?', "People say yes to be polite; watching what they do is more honest.", "It is fine, it asks about the design.", "Behaviour tells you more than opinions."),
        ],
      },
      {
        kind: "do", title: "Test with three people", minutes: 30,
        intro: "Run your two tasks with three people who have the problem.",
        actions: ["Run the test with 3 people", "Fill in your notes table", "Mark anything two or more people struggled with"],
        checks: [q("judge", "feedback patterns", "One person disliked the colour; three got stuck on the menu. What do you fix first?", "The menu — three people is a pattern.", "The colour, it's quick.", "Fix what many people struggle with before one person's taste.")],
      },
      { kind: "reflect", title: "Your top three fixes", minutes: 10, intro: "List the three changes that would help most people.", actions: ["Read your notes", "List three fixes", "Pick the first one to do"], checks: [] },
    ],
  },
  screen: {
    title: "Designing a clear first screen",
    goal: "Make the first page of my project clear in five seconds",
    summary: "People decide in seconds whether to stay. You'll practise what goes first on a screen and how to make the main action obvious.",
    steps: [
      {
        kind: "learn", title: "What do people see first?", minutes: 15,
        intro: "Visual hierarchy means the most important thing is biggest and first, so eyes go there.",
        example: "On a shop sign, the shop's name is huge and the phone number is small.",
        actions: ["Open your first screen", "Circle the biggest thing on it", "Ask: is that the most important thing?"],
        checks: [
          q("apply", "visual hierarchy", "Your page has a big logo and a tiny 'Read a story' button. What would you change?", "Make the button big and near the top, logo smaller.", "Add more colours.", "The most important action should be the most visible."),
          q("judge", "call to action", 'Which button is clearer: "Submit" or "Start reading"?', '"Start reading", it says what happens.', '"Submit", it is shorter.', "A call to action names what the user gets."),
        ],
      },
      {
        kind: "do", title: "The five-second test", minutes: 20,
        intro: "Show your screen to someone for five seconds, hide it, and ask what it was for.",
        actions: ["Show your screen for 5 seconds", "Ask what the page was for", "Change one thing and test again"],
        checks: [
          q("apply", "visual hierarchy", "After 5 seconds, your friend remembers only the picture. What does that tell you?", "The picture is winning; the title and button need to stand out more.", "That the picture is nice.", "What people remember shows what the screen makes most important."),
          q("judge", "call to action", "Should a first screen have one main button or five?", "One, so people know what to do.", "Five, so they have choices.", "One clear call to action beats many competing ones."),
        ],
      },
      { kind: "reflect", title: "What changed?", minutes: 10, intro: "Write what you changed and what people remembered the second time.", actions: ["Write the change", "Write what people remembered", "Decide your next change"], checks: [] },
    ],
  },
};

/** Stored step text, in the format lib/bloom/details.ts reads. */
export function stepDetails(step) {
  const facts = [step.example && `Example: ${step.example}`, step.need && `You need: ${step.need}`, `Time: about ${step.minutes} minutes`].filter(Boolean);
  return [step.intro, facts.join("\n"), step.actions.map((a, i) => `${i + 1}. ${a}`).join("\n")].filter(Boolean).join("\n\n");
}

export const REVIEW = {
  nailed: (c) => ({ verdict: "nailed", feedback: "Yes — that's exactly it. You put the idea into your own words.", key_idea: c.key }),
  nearly: (c) => ({ verdict: "nearly", feedback: "You're close. Think about what the other person would hear in your answer.", key_idea: c.key }),
  not_yet: (c) => ({ verdict: "not_yet", feedback: "Not quite yet — let's look at this one again in the next step with a new example.", key_idea: c.key }),
};

export const FEELING_NOTES = {
  too_easy: "That was quick, I already knew most of it.",
  just_right: "Good, the example helped.",
  too_hard: "I don't really get the difference. Can you show more examples?",
};
