// The demo school: groups, mentors, families and students (fictional people, Pakistani names).
// Every student has a "pattern" so each dashboard state shows up:
//   star     on time, strong answers, mentor approves most work
//   steady   on time, one thing waiting for review, one learning gap
//   behind   misses activities (2+ overdue)
//   quiet    started well, nothing for 9+ days
//   stuck    keeps working but misses the same ideas in Spark (2+ open gaps)
// Accounts use example.com (reserved, never delivered) and the app's .invalid student domain.

export const G1 = "00000000-0000-0000-0000-000000001001"; // existing "Group 1" from seed.sql
export const G2 = "00000000-0000-0000-0000-000000001002";
export const G3 = "00000000-0000-0000-0000-000000001003";
export const G4 = "00000000-0000-0000-0000-000000001004";

/** `week`: the programme week the group is in today; `startDate`: a fixed future start instead. */
export const COHORTS = [
  { id: G1, name: "Lahore Explorers · Sat 11 am", week: 2, schedule: { weekday: 6, start: "11:00", end: "12:30" } },
  { id: G3, name: "Islamabad Explorers · Sat 3 pm", week: 4, schedule: { weekday: 6, start: "15:00", end: "16:30" } },
  { id: G2, name: "Karachi Builders · Sun 4 pm", week: 6, schedule: { weekday: 0, start: "16:00", end: "17:30" } },
  { id: G4, name: "Peshawar · January 2027", startDate: "2027-01-09", schedule: { weekday: 6, start: "11:00", end: "12:30" } },
];

/** Mentors are assigned to groups, not to single students (Demo Mentor also helps in Islamabad). */
export const MENTORS = [
  { key: "ayesha", name: "Ayesha Siddiqui", email: "ayesha.siddiqui@example.com", cohorts: [G1] },
  { key: "usman", name: "Usman Tariq", email: "usman.tariq@example.com", cohorts: [G3] },
  { key: "hira", name: "Hira Baig", email: "hira.baig@example.com", cohorts: [G3] },
  { key: "bilal", name: "Bilal Ahmed Qureshi", email: "bilal.qureshi@example.com", cohorts: [G2] },
  { key: "sana", name: "Sana Malik", email: "sana.malik@example.com", cohorts: [G2] },
];
/** The existing demo mentor joins these groups too, so the demo login sees two groups. */
export const DEMO_MENTOR_EXTRA_COHORTS = [G3];

export const PARENTS = [
  { key: "farah", name: "Farah Hussain", email: "farah.hussain@example.com" },
  { key: "imran", name: "Imran Raza", email: "imran.raza@example.com" },
  { key: "nadia", name: "Nadia Sheikh", email: "nadia.sheikh@example.com", neverSignedIn: true },
  { key: "javed", name: "Javed Iqbal", email: "javed.iqbal@example.com" },
  { key: "amna", name: "Amna Chaudhry", email: "amna.chaudhry@example.com" },
  { key: "kashif", name: "Kashif Butt", email: "kashif.butt@example.com" },
  { key: "shazia", name: "Shazia Akhtar", email: "shazia.akhtar@example.com" },
  { key: "waqas", name: "Waqas Mirza", email: "waqas.mirza@example.com" },
  { key: "saima", name: "Saima Khan", email: "saima.khan@example.com" },
  { key: "asif", name: "Asif Memon", email: "asif.memon@example.com" },
  { key: "rubina", name: "Rubina Abbasi", email: "rubina.abbasi@example.com" },
  { key: "noor", name: "Noor Ahmed", email: "noor.ahmed@example.com" },
  { key: "tahir", name: "Tahir Farooq", email: "tahir.farooq@example.com", neverSignedIn: true },
  { key: "gul", name: "Gul Khattak", email: "gul.khattak@example.com" },
  { key: "zarina", name: "Zarina Afridi", email: "zarina.afridi@example.com" },
  { key: "yousaf", name: "Yousaf Ali", email: "yousaf.ali@example.com" },
];

/**
 * Students. `story` feeds their submissions, project and Spark paths. `consents`: what their parent
 * allowed (platform is always given). `fee`: Rs; `paid: false` = still owed.
 */
export const STUDENTS = [
  // ---- Lahore Explorers (week 2) ----
  {
    username: "zainab.hussain", name: "Zainab Hussain", age: 13, cohort: G1, group: "explorer", parent: "farah", relationship: "mother",
    pattern: "star", consents: ["ai", "bloom_ai", "media"], fee: 15000, paid: true,
    project: { area: "technology", status: "exploring", title: null, problem: null },
    story: {
      enjoy: "coding small games in Scratch, sketching, badminton with my cousins, baking with my nani, and reading mystery books",
      problems: ["Load-shedding cuts our study time in the evening; it affects every student on our street.", "Our school library is closed after 1 pm, so students who stay late can't borrow books.", "My younger brother forgets his homework diary; it affects him and my ammi who checks it every night."],
      ideas: ["A study planner that moves tasks around load-shedding hours, for students in my area", "A WhatsApp book-swap group for my class, for students without library access", "A colourful homework checklist poster, for my brother's class"],
      areas: "technology and design", favourite: "technology",
      made: "a tiny Scratch app that beeps 10 minutes before the light goes, and a Canva poster for a book swap",
    },
  },
  {
    username: "ali.raza", name: "Muhammad Ali Raza", age: 12, cohort: G1, group: "explorer", parent: "imran", relationship: "father",
    pattern: "steady", consents: ["ai", "bloom_ai"], fee: 15000, paid: true,
    project: { area: "business", status: "exploring", title: null, problem: null },
    story: {
      enjoy: "cricket, helping at my father's shop, Minecraft, making paper planes, and collecting stickers",
      problems: ["Customers at our shop wait a long time because prices are not written anywhere; it affects shoppers and my abbu.", "Our cricket team never knows who is coming on Sunday; it affects all eleven of us.", "Plastic bags fly around our gali after bazaar day; it affects everyone who lives there."],
      ideas: ["A price board and a simple price list for my father's shop", "A team sign-up sheet for Sunday cricket", "Cloth bags with our school logo to sell at the bazaar"],
      areas: "business and design", favourite: "business",
      made: "a price list for ten items in our shop and a logo idea for cloth bags",
    },
  },
  {
    username: "hamza.raza", name: "Hamza Raza", age: 14, cohort: G1, group: "explorer", parent: "imran", relationship: "father",
    pattern: "behind", consents: ["ai", "bloom_ai"], fee: 12000, discount: "sibling", paid: true,
    project: { area: "undecided", status: "exploring", title: null, problem: null },
    story: { enjoy: "football, PUBG, drawing cars", problems: [], ideas: [], areas: "", favourite: "", made: "" },
  },
  {
    username: "ayaan.sheikh", name: "Ayaan Sheikh", age: 14, cohort: G1, group: "explorer", parent: "nadia", relationship: "mother",
    pattern: "quiet", consents: ["bloom_ai"], fee: 15000, paid: true,
    project: { area: "design", status: "exploring", title: null, problem: null },
    story: {
      enjoy: "drawing anime characters, editing videos on CapCut, playing carrom, and cooking instant noodles",
      problems: ["Kids in my building have nowhere to play after the park closed; it affects about 20 children.", "My grandmother can't read the small text on her medicine boxes.", "The school van is always late; it affects 12 students on our route."],
      ideas: [], areas: "", favourite: "", made: "",
    },
  },
  {
    username: "maryam.javed", name: "Maryam Javed", age: 13, cohort: G1, group: "explorer", parent: "javed", relationship: "father",
    pattern: "stuck", prefersFemaleMentor: true, consents: ["ai", "bloom_ai"], fee: 15000, paid: true,
    project: { area: "social_impact", status: "exploring", title: null, problem: null },
    story: {
      enjoy: "writing poems in Urdu, gardening on our roof, helping my little sister read, and calligraphy",
      problems: ["Many girls in my mohalla stop reading after school because there is no library nearby.", "Our roof garden plants die in June because we forget to water them.", "Old people in our street don't know how to use mobile banking."],
      ideas: ["A small street library in a cupboard at our mosque's community room", "A watering rota for our roof garden", "A picture guide for using mobile banking"],
      areas: "social impact and design", favourite: "social impact",
      made: "a sign for a street library and a watering calendar",
    },
  },

  // ---- Islamabad Explorers (week 4) ----
  {
    username: "eshaal.chaudhry", name: "Eshaal Chaudhry", age: 13, cohort: G3, group: "explorer", parent: "amna", relationship: "mother",
    pattern: "star", consents: ["ai", "bloom_ai", "media"], fee: 15000, paid: true,
    project: { area: "social_impact", status: "chosen", title: "Boond — save water at wudu", problem: "Taps at our school wudu area run the whole time; about 300 litres are wasted every Zuhr." },
    story: {
      enjoy: "science experiments, swimming, making short documentaries on my phone, and visiting Margalla trails",
      problems: ["Taps at the school wudu area are left running; it affects the whole school's water tank.", "Students at our school don't know which bin is for recycling.", "Our neighbourhood park has no shade, so children can't play in the afternoon."],
      ideas: ["Boond: reminder signs and a measured cup for wudu", "Picture labels for school bins", "A petition for trees in the park"],
      areas: "social impact and design", favourite: "social impact",
      made: "a 30-second video about water and a simple poster",
      who: "students and teachers who do wudu at school", interviews: "Three classmates said they leave the tap on because the water is slow to warm up. Our caretaker said the tank runs empty by Asr twice a week.",
      build: "a set of reminder stickers and a one-page Canva guide showing how to do wudu with one jug of water",
      tool: "Canva", slug: "boond-wudu",
    },
  },
  {
    username: "rayyan.butt", name: "Rayyan Butt", age: 12, cohort: G3, group: "explorer", parent: "kashif", relationship: "father",
    pattern: "steady", consents: ["ai", "bloom_ai"], fee: 15000, paid: true,
    project: { area: "business", status: "chosen", title: "Canteen Express", problem: "The canteen queue takes the whole break, so many students go back to class hungry." },
    story: {
      enjoy: "selling homemade lemonade, cycling, chess, and watching cooking shows",
      problems: ["The canteen queue takes the whole break; it affects most of the junior school.", "My chess club has no way to track scores.", "Our street's waste is collected late, so it smells."],
      ideas: ["Canteen Express: pre-order slips for the canteen", "A chess ladder board", "A reminder group for waste collection day"],
      areas: "business and technology", favourite: "business",
      made: "a lemonade price sheet and a pre-order slip",
      who: "junior school students with a 20-minute break", interviews: "Two friends said they skip lunch twice a week. The canteen uncle said he could prepare orders if he knew them by 9 am.",
      build: "a paper pre-order slip and a Google Form so students order before assembly",
      tool: "Google Forms", slug: "canteen-express",
    },
  },
  {
    username: "laiba.akhtar", name: "Laiba Akhtar", age: 14, cohort: G3, group: "explorer", parent: "shazia", relationship: "mother",
    pattern: "stuck", prefersFemaleMentor: true, consents: ["ai", "bloom_ai"], fee: 15000, paid: true,
    project: { area: "design", status: "chosen", title: "Kahani Ghar", problem: "My little brother and his friends have almost no Urdu story books with pictures they like." },
    story: {
      enjoy: "illustrating, Urdu stories, singing naats, and making slime",
      problems: ["Young children have few Urdu picture books.", "My school bag is too heavy; it affects most of my class.", "Our school website is hard to use on a phone."],
      ideas: ["Kahani Ghar: illustrated Urdu stories for young kids", "A timetable to carry fewer books", "A simpler page for the school website"],
      areas: "design and technology", favourite: "design",
      made: "two illustrated pages of a story",
      who: "children aged 5-8 and their parents", interviews: "My brother's friends liked stories with animals. One mother said the books in shops are too expensive.",
      build: "an illustrated Urdu story book in Canva, shared as a PDF",
      tool: "Canva", slug: "kahani-ghar",
    },
  },
  {
    username: "abdullah.mirza", name: "Abdullah Mirza", age: 13, cohort: G3, group: "explorer", parent: "waqas", relationship: "father",
    pattern: "behind", consents: ["ai", "bloom_ai"], fee: 15000, paid: true,
    project: { area: "undecided", status: "exploring", title: null, problem: null },
    story: {
      enjoy: "football, FIFA, fixing my bicycle",
      problems: ["Our football ground floods after rain.", "My bicycle chain keeps breaking.", "Nobody knows when the school bus will come."],
      ideas: [], areas: "technology and business", favourite: "technology", made: "a quick list of bike repair costs",
    },
  },

  // ---- Karachi Builders (week 6) ----
  {
    username: "areeba.khan", name: "Areeba Khan", age: 16, cohort: G2, group: "builder", parent: "saima", relationship: "mother",
    pattern: "star", consents: ["ai", "bloom_ai", "public_portfolio", "media"], fee: 15000, paid: true, public: true,
    project: { area: "business", status: "building", title: "Hisaab — pocket money for teens", problem: "Teenagers in my class run out of pocket money by the third week and don't know where it went." },
    story: {
      enjoy: "spreadsheets (really), debating, Instagram reels about money, and biryani with friends",
      problems: ["Teens run out of pocket money before month end.", "Tuition centres don't share fee information online.", "Small home bakers can't track their orders."],
      ideas: ["Hisaab: a pocket money tracker with weekly limits", "A fee comparison sheet for tuition centres", "An order tracker for home bakers"],
      areas: "business and technology", favourite: "business",
      redesign: "the school fee portal: it shows only the total, not what each fee is for. I mocked up a breakdown page.",
      made: "a budgeting sheet for a week of school and a landing page draft",
      who: "students aged 14-18 who get weekly pocket money", interviews: "I interviewed 12 classmates. 9 said they run out by the third week; 7 spend most on food delivery; only 2 track anything.",
      build: "Hisaab, a Glide app where you log spending in two taps and see how much is left this week",
      tool: "Glide", slug: "hisaab-app",
    },
  },
  {
    username: "daniyal.memon", name: "Daniyal Memon", age: 17, cohort: G2, group: "builder", parent: "asif", relationship: "father",
    pattern: "steady", consents: ["ai", "bloom_ai"], fee: 15000, paid: true,
    project: { area: "social_impact", status: "building", title: "Saaf Sahil — beach clean-up crew", problem: "Clifton beach is full of plastic after weekends, and volunteers don't know when or where to help." },
    story: {
      enjoy: "surfing videos, photography, organising events, and volunteering with the scouts",
      problems: ["Plastic on Clifton beach after weekends.", "Volunteers can't find clean-up events.", "Street dogs in our area have no water in summer."],
      ideas: ["Saaf Sahil: a sign-up page for monthly beach clean-ups", "A volunteer calendar for scouts", "Water bowls for street dogs"],
      areas: "social impact and design", favourite: "social impact",
      redesign: "the scouts' Facebook page: event dates are buried in posts. I mocked up a pinned events card.",
      made: "a photo story of the beach and a sign-up form",
      who: "students and families in Clifton and DHA who want to volunteer", interviews: "I asked 10 people at the beach. 8 would join if it was on a Sunday morning; 6 wanted gloves and bags provided.",
      build: "a Carrd page with dates, a sign-up form and a kit list",
      tool: "Carrd", slug: "saaf-sahil",
    },
  },
  {
    username: "fatima.noor", name: "Fatima Noor", age: 16, cohort: G2, group: "builder", parent: "noor", relationship: "father",
    pattern: "stuck", prefersFemaleMentor: true, consents: ["ai", "bloom_ai"], fee: 15000, paid: true,
    project: { area: "design", status: "building", title: "Sitara Sportswear", problem: "Girls at my school who want modest sportswear can't find anything comfortable for PE." },
    story: {
      enjoy: "fashion sketching, netball, sewing, and Pinterest boards",
      problems: ["Girls can't find modest, comfortable sportswear.", "Our netball team has no kit.", "Tailors take weeks to stitch uniforms."],
      ideas: ["Sitara: a modest sportswear line", "A kit fundraiser for the netball team", "An online booking for school tailors"],
      areas: "design and business", favourite: "design",
      redesign: "a clothing brand's Instagram shop: sizes are only in the comments. I sketched a size guide post.",
      made: "three sketches and a mood board",
      who: "girls aged 13-18 who play sports at school", interviews: "I interviewed 10 girls from my school. 7 said they skip PE sometimes because their clothes are uncomfortable.",
      build: "a brand page on Instagram with a lookbook and a pre-order form",
      tool: "Canva and Instagram", slug: "sitara-sportswear",
    },
  },
  {
    username: "hassan.abbasi", name: "Hassan Abbasi", age: 15, cohort: G2, group: "builder", parent: "rubina", relationship: "mother",
    pattern: "behind", consents: [], fee: 15000, paid: false,
    project: { area: "technology", status: "exploring", title: "Tuition finder", problem: null },
    story: {
      enjoy: "gaming, Python tutorials on YouTube, cricket",
      problems: ["Finding a good tuition teacher nearby is hard.", "Our internet goes down every evening.", "Students don't know about scholarships."],
      ideas: ["A tuition finder for Lyari", "An internet outage tracker", "A scholarship list"],
      areas: "technology", favourite: "technology",
      redesign: "a tuition centre's website: there are no fees or timings. I listed what should be on the first page.",
      made: "", who: "", interviews: "", build: "", tool: "", slug: "",
    },
  },
  {
    username: "omar.farooq", name: "Omar Farooq", age: 18, cohort: G2, group: "builder", parent: "tahir", relationship: "father",
    pattern: "quiet", consents: ["ai", "bloom_ai"], fee: 15000, paid: true,
    project: { area: "technology", status: "chosen", title: "Rickshaw fare check", problem: "Students taking rickshaws to college are often overcharged because they don't know a fair fare." },
    story: {
      enjoy: "cars, maps, building PCs, and late-night cricket",
      problems: ["Students get overcharged by rickshaws.", "Bus routes in Karachi are hard to understand.", "PC parts prices change every week."],
      ideas: ["A rickshaw fare estimator", "A simple map of bus routes", "A PC parts price tracker"],
      areas: "technology and business", favourite: "technology",
      redesign: "the Karachi bus route map: it's a huge PDF. I sketched a search-by-stop screen.",
      made: "a fare table for five routes",
      who: "college students who take rickshaws daily", interviews: "I asked 10 students. 8 said they had been overcharged in the last month.",
      build: "", tool: "Glide", slug: "",
    },
  },

  // ---- Peshawar (starts in January) ----
  {
    username: "shahzaib.khattak", name: "Shahzaib Khattak", age: 15, cohort: G4, group: "builder", parent: "gul", relationship: "father",
    pattern: "new", consents: ["ai", "bloom_ai"], fee: 15000, paid: false,
    project: null, story: {},
  },
  {
    username: "mahnoor.afridi", name: "Mahnoor Afridi", age: 13, cohort: G4, group: "explorer", parent: "zarina", relationship: "mother",
    pattern: "new", consents: ["ai"], fee: 15000, paid: true,
    project: null, story: {},
  },

  // ---- Registered, not in a group yet ----
  {
    username: "saad.yousaf", name: "Saad Yousaf", age: 14, cohort: null, parent: "yousaf", relationship: "father",
    pattern: "new", consents: [], project: null, story: {},
  },
];
