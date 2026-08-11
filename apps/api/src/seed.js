/**
 * Seed script — run with: npm run seed (from apps/api/)
 *
 * Hierarchy:
 *   New Delhi (city)
 *   ├── South Delhi Municipal Corp (municipality)
 *   │   ├── Vasant Kunj Colony    → colony-vk@  | locvka@, locvkb@
 *   │   ├── Hauz Khas Colony      → colony-hk@  | lochkv@, locsda@
 *   │   └── Malviya Nagar Colony  → colony-mn@  | locmna@, locmnb@
 *   └── North Delhi Municipal Corp (municipality)
 *       ├── Rohini Colony         → colony-rohini@ | locro3@, locro7@
 *       ├── Pitampura Colony      → colony-pit@    | locptv@, locpts@
 *       └── Shalimar Bagh Colony  → colony-sb@     | locsba@, locsbb@
 *
 * Each locality has: 1 RWA official, 2 citizens, 2 issues, 1 poll, 1 discussion
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/civicpulse";

const Location   = require("./models/Location");
const User       = require("./models/User");
const Issue      = require("./models/Issue");
const Poll       = require("./models/Poll");
const Discussion = require("./models/Discussion");
const Message    = require("./models/Message");

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB:", MONGODB_URI);

  await Promise.all([
    Location.deleteMany({}), User.deleteMany({}),
    Issue.deleteMany({}),    Poll.deleteMany({}),
    Discussion.deleteMany({}), Message.deleteMany({}),
  ]);
  console.log("🧹 Cleared existing data");

  // ── 1. Location Hierarchy ─────────────────────────────────────────────────
  const city = await Location.create({ name: "New Delhi", tier: "city", parentId: null, ancestors: [] });

  const muniSouth = await Location.create({ name: "South Delhi Municipal Corporation", tier: "municipality", parentId: city._id, ancestors: [city._id] });
  const muniNorth = await Location.create({ name: "North Delhi Municipal Corporation", tier: "municipality", parentId: city._id, ancestors: [city._id] });

  const colVK = await Location.create({ name: "Vasant Kunj Colony",   tier: "colony", parentId: muniSouth._id, ancestors: [city._id, muniSouth._id] });
  const colHK = await Location.create({ name: "Hauz Khas Colony",     tier: "colony", parentId: muniSouth._id, ancestors: [city._id, muniSouth._id] });
  const colMN = await Location.create({ name: "Malviya Nagar Colony", tier: "colony", parentId: muniSouth._id, ancestors: [city._id, muniSouth._id] });
  const colRO = await Location.create({ name: "Rohini Colony",        tier: "colony", parentId: muniNorth._id, ancestors: [city._id, muniNorth._id] });
  const colPT = await Location.create({ name: "Pitampura Colony",     tier: "colony", parentId: muniNorth._id, ancestors: [city._id, muniNorth._id] });
  const colSB = await Location.create({ name: "Shalimar Bagh Colony", tier: "colony", parentId: muniNorth._id, ancestors: [city._id, muniNorth._id] });

  // 12 Localities — 2 per colony
  const locVKA = await Location.create({ name: "Vasant Kunj Sector A",      tier: "locality", parentId: colVK._id, ancestors: [city._id, muniSouth._id, colVK._id] });
  const locVKB = await Location.create({ name: "Vasant Kunj Sector B",      tier: "locality", parentId: colVK._id, ancestors: [city._id, muniSouth._id, colVK._id] });
  const locHKV = await Location.create({ name: "Hauz Khas Village",         tier: "locality", parentId: colHK._id, ancestors: [city._id, muniSouth._id, colHK._id] });
  const locSDA = await Location.create({ name: "SDA Locality",              tier: "locality", parentId: colHK._id, ancestors: [city._id, muniSouth._id, colHK._id] });
  const locMNA = await Location.create({ name: "Malviya Nagar Block A",     tier: "locality", parentId: colMN._id, ancestors: [city._id, muniSouth._id, colMN._id] });
  const locMNB = await Location.create({ name: "Malviya Nagar Block B",     tier: "locality", parentId: colMN._id, ancestors: [city._id, muniSouth._id, colMN._id] });
  const locRO3 = await Location.create({ name: "Rohini Sector 3",           tier: "locality", parentId: colRO._id, ancestors: [city._id, muniNorth._id, colRO._id] });
  const locRO7 = await Location.create({ name: "Rohini Sector 7",           tier: "locality", parentId: colRO._id, ancestors: [city._id, muniNorth._id, colRO._id] });
  const locPTV = await Location.create({ name: "Pitampura TV Tower Block",  tier: "locality", parentId: colPT._id, ancestors: [city._id, muniNorth._id, colPT._id] });
  const locPTS = await Location.create({ name: "Pitampura Sainik Vihar",    tier: "locality", parentId: colPT._id, ancestors: [city._id, muniNorth._id, colPT._id] });
  const locSBA = await Location.create({ name: "Shalimar Bagh Block A",     tier: "locality", parentId: colSB._id, ancestors: [city._id, muniNorth._id, colSB._id] });
  const locSBB = await Location.create({ name: "Shalimar Bagh Block B",     tier: "locality", parentId: colSB._id, ancestors: [city._id, muniNorth._id, colSB._id] });

  const localities = [locVKA, locVKB, locHKV, locSDA, locMNA, locMNB, locRO3, locRO7, locPTV, locPTS, locSBA, locSBB];
  console.log("🏙️  Created: 1 city → 2 municipalities → 6 colonies → 12 localities");

  // ── 2. Users ──────────────────────────────────────────────────────────────
  const hash = (pw) => bcrypt.hash(pw, 12);
  const offHash = await hash("official123");
  const citHash = await hash("citizen123");
  const modHash = await hash("moderator123");
  const rwaHash = await hash("rwa123");

  // City official
  const cityOfficial = await User.create({ name: "Commissioner Sharma",     email: "city@civicpulse.app",          passwordHash: offHash, role: "official",  locationId: city._id,    scopeTier: "city" });
  // Municipality officials
  const muniSOff   = await User.create({ name: "Deputy Comm. Priya Mehta", email: "muni-south@civicpulse.app",    passwordHash: offHash, role: "official",  locationId: muniSouth._id, scopeTier: "municipality" });
  const muniNOff   = await User.create({ name: "Deputy Comm. Ravi Kumar",  email: "muni-north@civicpulse.app",    passwordHash: offHash, role: "official",  locationId: muniNorth._id, scopeTier: "municipality" });
  // Colony officials
  const offVK = await User.create({ name: "Colony Admin Suresh (VK)",      email: "colony-vk@civicpulse.app",     passwordHash: offHash, role: "official",  locationId: colVK._id, scopeTier: "colony" });
  const offHK = await User.create({ name: "Colony Admin Anita (HK)",       email: "colony-hk@civicpulse.app",     passwordHash: offHash, role: "official",  locationId: colHK._id, scopeTier: "colony" });
  const offMN = await User.create({ name: "Colony Admin Deepak (MN)",      email: "colony-mn@civicpulse.app",     passwordHash: offHash, role: "official",  locationId: colMN._id, scopeTier: "colony" });
  const offRO = await User.create({ name: "Colony Admin Neha (Rohini)",    email: "colony-rohini@civicpulse.app", passwordHash: offHash, role: "official",  locationId: colRO._id, scopeTier: "colony" });
  const offPT = await User.create({ name: "Colony Admin Vikram (Pit)",     email: "colony-pit@civicpulse.app",    passwordHash: offHash, role: "official",  locationId: colPT._id, scopeTier: "colony" });
  const offSB = await User.create({ name: "Colony Admin Kavita (SB)",      email: "colony-sb@civicpulse.app",     passwordHash: offHash, role: "official",  locationId: colSB._id, scopeTier: "colony" });
  // Moderator
  await User.create({ name: "Meena Moderator", email: "moderator@civicpulse.app", passwordHash: modHash, role: "moderator", locationId: city._id, scopeTier: "city" });

  // ── Locality RWA officials (1 per locality, password: rwa123) ──────────────
  const rwaData = [
    { name: "RWA Pres. Anil Saxena",   email: "rwa-vka@civicpulse.app",  loc: locVKA },
    { name: "RWA Pres. Seema Joshi",   email: "rwa-vkb@civicpulse.app",  loc: locVKB },
    { name: "RWA Pres. Mohan Lal",     email: "rwa-hkv@civicpulse.app",  loc: locHKV },
    { name: "RWA Pres. Radha Menon",   email: "rwa-sda@civicpulse.app",  loc: locSDA },
    { name: "RWA Pres. Tarun Bhat",    email: "rwa-mna@civicpulse.app",  loc: locMNA },
    { name: "RWA Pres. Suman Yadav",   email: "rwa-mnb@civicpulse.app",  loc: locMNB },
    { name: "RWA Pres. Ajay Sharma",   email: "rwa-ro3@civicpulse.app",  loc: locRO3 },
    { name: "RWA Pres. Nisha Kapoor",  email: "rwa-ro7@civicpulse.app",  loc: locRO7 },
    { name: "RWA Pres. Dev Malhotra",  email: "rwa-ptv@civicpulse.app",  loc: locPTV },
    { name: "RWA Pres. Pooja Rawat",   email: "rwa-pts@civicpulse.app",  loc: locPTS },
    { name: "RWA Pres. Girish Nair",   email: "rwa-sba@civicpulse.app",  loc: locSBA },
    { name: "RWA Pres. Uma Desai",     email: "rwa-sbb@civicpulse.app",  loc: locSBB },
  ];
  const rwaOfficials = await Promise.all(rwaData.map(({ name, email, loc }) =>
    User.create({ name, email, passwordHash: rwaHash, role: "official", locationId: loc._id, scopeTier: "locality" })
  ));

  // ── Citizens: 2 per locality (24 total) ───────────────────────────────────
  const citizenData = [
    // locVKA
    { name: "Amit Verma",       email: "citizen-vka1@civicpulse.app", loc: locVKA },
    { name: "Priti Sharma",     email: "citizen-vka2@civicpulse.app", loc: locVKA },
    // locVKB
    { name: "Rohan Gupta",      email: "citizen-vkb1@civicpulse.app", loc: locVKB },
    { name: "Anjali Singh",     email: "citizen-vkb2@civicpulse.app", loc: locVKB },
    // locHKV
    { name: "Sunita Rao",       email: "citizen-hkv1@civicpulse.app", loc: locHKV },
    { name: "Kiran Mehta",      email: "citizen-hkv2@civicpulse.app", loc: locHKV },
    // locSDA
    { name: "Farhan Khan",      email: "citizen-sda1@civicpulse.app", loc: locSDA },
    { name: "Noor Bano",        email: "citizen-sda2@civicpulse.app", loc: locSDA },
    // locMNA
    { name: "Deepa Iyer",       email: "citizen-mna1@civicpulse.app", loc: locMNA },
    { name: "Sanjay Pillai",    email: "citizen-mna2@civicpulse.app", loc: locMNA },
    // locMNB
    { name: "Rekha Nair",       email: "citizen-mnb1@civicpulse.app", loc: locMNB },
    { name: "Arjun Das",        email: "citizen-mnb2@civicpulse.app", loc: locMNB },
    // locRO3
    { name: "Priya Singh",      email: "citizen-ro31@civicpulse.app", loc: locRO3 },
    { name: "Manoj Kumar",      email: "citizen-ro32@civicpulse.app", loc: locRO3 },
    // locRO7
    { name: "Vandana Tiwari",   email: "citizen-ro71@civicpulse.app", loc: locRO7 },
    { name: "Suresh Pal",       email: "citizen-ro72@civicpulse.app", loc: locRO7 },
    // locPTV
    { name: "Rahul Gupta",      email: "citizen-ptv1@civicpulse.app", loc: locPTV },
    { name: "Smita Verma",      email: "citizen-ptv2@civicpulse.app", loc: locPTV },
    // locPTS
    { name: "Aakash Thakur",    email: "citizen-pts1@civicpulse.app", loc: locPTS },
    { name: "Leela Jain",       email: "citizen-pts2@civicpulse.app", loc: locPTS },
    // locSBA
    { name: "Meera Nair",       email: "citizen-sba1@civicpulse.app", loc: locSBA },
    { name: "Vivek Mishra",     email: "citizen-sba2@civicpulse.app", loc: locSBA },
    // locSBB
    { name: "Lalita Rao",       email: "citizen-sbb1@civicpulse.app", loc: locSBB },
    { name: "Harish Chand",     email: "citizen-sbb2@civicpulse.app", loc: locSBB },
  ];
  const allCitizens = await Promise.all(citizenData.map(({ name, email, loc }) =>
    User.create({ name, email, passwordHash: citHash, role: "citizen", locationId: loc._id, scopeTier: "locality" })
  ));

  // Helper to get citizens for a given locationId
  const getCit = (loc, n = 0) => allCitizens.filter(c => String(c.locationId) === String(loc._id))[n];
  const getRWA = (loc) => rwaOfficials.find(r => String(r.locationId) === String(loc._id));

  console.log("👤 Created: city(1) + muni(2) + colony(6) + rwa(12) + moderator(1) + citizens(24) users");

  // ── 3. Issues ─────────────────────────────────────────────────────────────
  const SLA = { locality: 48 * 3600000, colony: 72 * 3600000, municipality: 120 * 3600000 };
  const future = (h) => new Date(Date.now() + h * 3600000);
  const past   = (h) => new Date(Date.now() - h * 3600000);

  // Two issues per locality (realistic local problems)
  const issueTemplates = [
    // locVKA
    { loc: locVKA, c: 0, title: "Broken streetlight on Sector A-5 road", desc: "The streetlight near the park entrance has been dark for 2 weeks. Residents are afraid to walk at night.", tags: ["infrastructure","safety"], votes: { up: 23, down: 2 }, status: "open", sla: future(36) },
    { loc: locVKA, c: 1, title: "Stray dog menace near children's park", desc: "A pack of stray dogs near the play area is causing fear among children and parents.", tags: ["safety","animals"], votes: { up: 15, down: 0 }, status: "under_review", sla: future(12) },
    // locVKB
    { loc: locVKB, c: 0, title: "Potholes on Sector B main road", desc: "Multiple deep potholes on the approach road to the market. Two bike accidents reported last week.", tags: ["roads"], votes: { up: 31, down: 1 }, status: "open", sla: future(24) },
    { loc: locVKB, c: 1, title: "Water leakage from underground pipe", desc: "Continuous water leaking since 3 days near gate no. 4. Water wastage and road slippery.", tags: ["water","infrastructure"], votes: { up: 19, down: 0 }, status: "open", sla: future(40) },
    // locHKV
    { loc: locHKV, c: 0, title: "Garbage bins overflowing near market", desc: "The three garbage bins near Hauz Khas village market haven't been emptied in 4 days.", tags: ["sanitation"], votes: { up: 44, down: 3 }, status: "open", sla: past(5) },
    { loc: locHKV, c: 1, title: "Encroachment on public footpath", desc: "A shop has permanently placed furniture on the public footpath making it unusable for pedestrians.", tags: ["encroachment","infrastructure"], votes: { up: 28, down: 2 }, status: "approved", sla: future(20) },
    // locSDA
    { loc: locSDA, c: 0, title: "Open drain overflow during rain", desc: "The main drain near SDA market overflows every time it rains, causing waterlogging for hours.", tags: ["waterlogging","drain"], votes: { up: 67, down: 5 }, status: "under_review", sla: future(10),
      escalated: true, fromLoc: locSDA, toLoc: colHK, esc_reason: "SLA breach at locality tier" },
    { loc: locSDA, c: 1, title: "No street sweeping for 6 days", desc: "Street sweeping staff have not appeared since last Monday. Leaves and dust accumulating.", tags: ["sanitation"], votes: { up: 12, down: 0 }, status: "open", sla: future(30) },
    // locMNA
    { loc: locMNA, c: 0, title: "Defunct traffic light at Block A junction", desc: "The traffic signal at the main Block A junction has been non-functional for 10 days. Near-miss accidents daily.", tags: ["roads","safety"], votes: { up: 78, down: 4 }, status: "open", sla: past(3) },
    { loc: locMNA, c: 1, title: "Illegal dumping near residential walls", desc: "Construction debris and household waste being illegally dumped on the public land behind Block A-12.", tags: ["sanitation","encroachment"], votes: { up: 22, down: 1 }, status: "open", sla: future(44) },
    // locMNB
    { loc: locMNB, c: 0, title: "Park lights not working since a week", desc: "All 6 sodium lamps in the Malviya Nagar Block B park are out. Park is unusable at night.", tags: ["infrastructure","safety"], votes: { up: 35, down: 0 }, status: "implemented", sla: future(50) },
    { loc: locMNB, c: 1, title: "Broken boundary wall on south side", desc: "The park's south-side boundary wall has collapsed creating an unsafe entry point.", tags: ["infrastructure"], votes: { up: 18, down: 1 }, status: "open", sla: future(20) },
    // locRO3
    { loc: locRO3, c: 0, title: "No garbage collection for 5 days", desc: "No garbage truck has come to Rohini Sector 3 since Tuesday. Waste piling at the corner.", tags: ["sanitation"], votes: { up: 41, down: 1 }, status: "open", sla: past(2) },
    { loc: locRO3, c: 1, title: "Footpath dug up and not repaired", desc: "Footpath was dug for cable work 3 weeks ago but never refilled. Residents forced onto road.", tags: ["roads","infrastructure"], votes: { up: 29, down: 0 }, status: "under_review", sla: future(18) },
    // locRO7
    { loc: locRO7, c: 0, title: "Water tanker not arriving on schedule", desc: "The municipal water tanker hasn't come for 3 days. Residents buying bottled water.", tags: ["water"], votes: { up: 53, down: 2 }, status: "open", sla: future(6) },
    { loc: locRO7, c: 1, title: "Broken bench and play equipment in park", desc: "Two benches broken, swing chain missing, see-saw stuck. Children can't use the park.", tags: ["infrastructure","parks"], votes: { up: 20, down: 0 }, status: "open", sla: future(36) },
    // locPTV
    { loc: locPTV, c: 0, title: "Pothole on main market road causing accidents", desc: "Large pothole at the junction near TV Tower causing accidents. Three vehicles damaged last week.", tags: ["roads","safety"], votes: { up: 88, down: 3 }, status: "implemented", sla: future(60) },
    { loc: locPTV, c: 1, title: "Water logging near block entrance gate", desc: "Water stagnates for 2–3 days after every rain near the main gate. Mosquito breeding concern.", tags: ["waterlogging","health"], votes: { up: 34, down: 2 }, status: "open", sla: future(20) },
    // locPTS
    { loc: locPTS, c: 0, title: "Sewage overflow on Sainik Vihar road", desc: "Sewage manhole is overflowing near the temple. Foul smell and health hazard for residents.", tags: ["sanitation","health"], votes: { up: 61, down: 4 }, status: "under_review", sla: future(8) },
    { loc: locPTS, c: 1, title: "Missing manhole cover on main road", desc: "A manhole cover is missing near the bus stop creating a dangerous open hole on the road.", tags: ["roads","safety"], votes: { up: 49, down: 1 }, status: "approved", sla: future(16) },
    // locSBA
    { loc: locSBA, c: 0, title: "Street lights out in entire Block A stretch", desc: "The entire 400m stretch of Block A road has no working streetlights for 5 nights.", tags: ["infrastructure","safety"], votes: { up: 56, down: 2 }, status: "open", sla: past(1) },
    { loc: locSBA, c: 1, title: "Stray cattle blocking road during rush hour", desc: "A group of stray cattle regularly blocks the road between 8–9 AM causing traffic jams.", tags: ["safety","animals"], votes: { up: 17, down: 0 }, status: "open", sla: future(42) },
    // locSBB
    { loc: locSBB, c: 0, title: "Broken water pipeline near community hall", desc: "A visible crack in the water main near the community hall has been leaking for 4 days.", tags: ["water","infrastructure"], votes: { up: 38, down: 1 }, status: "open", sla: future(22) },
    { loc: locSBB, c: 1, title: "Encroachment on community hall parking", desc: "A vendor has set up a semi-permanent stall on the community hall parking area.", tags: ["encroachment"], votes: { up: 14, down: 0 }, status: "open", sla: future(46) },
  ];

  for (const t of issueTemplates) {
    const citizen = getCit(t.loc, t.c);
    const issueDoc = {
      title: t.title, description: t.desc, tags: t.tags,
      createdBy: citizen._id,
      originLocationId: t.loc._id,
      currentLocationId: t.escalated ? t.toLoc._id : t.loc._id,
      status: t.status, votes: t.votes,
      slaDeadline: t.sla,
    };
    if (t.escalated) {
      issueDoc.escalationHistory = [{
        fromLocationId: t.fromLoc._id, toLocationId: t.toLoc._id,
        atTier: "locality", movedAt: past(50), reason: t.esc_reason,
      }];
    }
    await Issue.create(issueDoc);
  }
  console.log("📋 Created 24 issues (2 per locality — mix of open/reviewed/implemented/escalated/SLA-breached)");

  // ── 4. Polls ──────────────────────────────────────────────────────────────
  // Locality-level polls (created by RWA official, visible only to that locality + higher)
  const localityPolls = [
    { loc: locVKA, question: "Best time for RWA monthly meeting?", options: ["Saturday 10 AM", "Sunday 6 PM", "Weekday evening 7 PM"], rwa: getRWA(locVKA), days: 5 },
    { loc: locVKB, question: "Should we install CCTV cameras at the main gate?", options: ["Yes, immediately", "Yes, after budget approval", "No, not necessary"], rwa: getRWA(locVKB), days: 7 },
    { loc: locHKV, question: "Priority repair for this month's maintenance fund?", options: ["Fix footpath", "Repair park boundary wall", "Paint common areas", "Fix broken gate hinges"], rwa: getRWA(locHKV), days: 6 },
    { loc: locSDA, question: "Should we hire a private security guard for nights?", options: ["Yes, shared cost among flats", "No, rely on police patrolling", "Install better lighting instead"], rwa: getRWA(locSDA), days: 8 },
    { loc: locMNA, question: "Preferred day for community clean-up drive?", options: ["Sunday morning", "Saturday evening", "Any holiday"], rwa: getRWA(locMNA), days: 4 },
    { loc: locMNB, question: "Should composting bins be installed in the park?", options: ["Yes, great idea", "No, will attract pests", "Only if properly maintained"], rwa: getRWA(locMNB), days: 10 },
    { loc: locRO3, question: "Should the park be reserved for residents only?", options: ["Yes, need resident ID", "No, keep it open to all", "Open but with rules"], rwa: getRWA(locRO3), days: 6 },
    { loc: locRO7, question: "Which road needs repair most urgently?", options: ["Main entry road", "Road near school", "Internal lanes", "Road near market"], rwa: getRWA(locRO7), days: 7 },
    { loc: locPTV, question: "Should we start a residents WhatsApp group for issues?", options: ["Yes, official group", "Already have one", "No, use this app instead"], rwa: getRWA(locPTV), days: 5 },
    { loc: locPTS, question: "Water timing preference — morning or evening supply?", options: ["Morning 6–8 AM", "Evening 6–8 PM", "Both, split 1 hour each"], rwa: getRWA(locPTS), days: 8 },
    { loc: locSBA, question: "Preferred method to collect monthly maintenance?", options: ["Online bank transfer", "Cash to RWA secretary", "Cheque at community meeting"], rwa: getRWA(locSBA), days: 7 },
    { loc: locSBB, question: "Should a speed breaker be installed on the internal road?", options: ["Yes, urgently needed", "Yes, but small ones only", "No, it slows emergency vehicles"], rwa: getRWA(locSBB), days: 6 },
  ];

  for (const p of localityPolls) {
    await Poll.create({
      question: p.question, options: p.options,
      locationId: p.loc._id, tier: "locality",
      createdBy: p.rwa._id,
      closesAt: new Date(Date.now() + p.days * 24 * 3600000),
    });
  }

  // Colony-level polls (visible to all localities in that colony)
  await Poll.create({ question: "Should the park closing time be extended to 10 PM?", options: ["Yes, extend to 10 PM", "Yes, extend to midnight", "No, keep current 9 PM", "Need more lighting first"], locationId: colVK._id, tier: "colony", createdBy: offVK._id, closesAt: new Date(Date.now() + 7 * 24 * 3600000) });
  await Poll.create({ question: "Preferred timing for monsoon drain cleaning?", options: ["Before May 1", "Before June 1", "After first rain as needed"], locationId: colRO._id, tier: "colony", createdBy: offRO._id, closesAt: new Date(Date.now() + 5 * 24 * 3600000) });

  // City-level poll (visible to all)
  await Poll.create({ question: "Top city infrastructure priority for this quarter?", options: ["Repair roads and pavements", "Upgrade street lighting", "Improve drainage systems", "Plant more trees"], locationId: city._id, tier: "city", createdBy: cityOfficial._id, closesAt: new Date(Date.now() + 14 * 24 * 3600000) });

  console.log("🗳️  Created 15 polls (12 locality + 2 colony + 1 city-wide)");

  // ── 5. Discussions ────────────────────────────────────────────────────────
  const discTemplates = [
    { loc: locVKA, creator: getCit(locVKA, 0), title: "Ideas to improve Sector A park", msgs: [
      { author: getCit(locVKA, 0), text: "We should add more benches near the walking track. The current ones are broken." },
      { author: getCit(locVKA, 1), text: "A water drinking station near the park entrance would help a lot in summer." },
      { author: getRWA(locVKA),    text: "Good suggestions. I will include these in the next RWA meeting agenda." },
    ]},
    { loc: locVKB, creator: getCit(locVKB, 0), title: "Pothole situation on Sector B road — who's responsible?", msgs: [
      { author: getCit(locVKB, 0), text: "The pothole near the market has been there for 3 months. Multiple complaints filed." },
      { author: getCit(locVKB, 1), text: "I've seen the colony admin's team inspect it twice but no repair yet." },
      { author: getRWA(locVKB),    text: "This is under the municipality's jurisdiction. We have escalated it formally. Update by next week." },
    ]},
    { loc: locHKV, creator: getCit(locHKV, 0), title: "Festival decoration planning for Diwali", msgs: [
      { author: getCit(locHKV, 0), text: "Should we do joint decoration this year across the village?" },
      { author: getCit(locHKV, 1), text: "Yes! Last year's individual decoration looked patchy. A unified theme would look great." },
      { author: getRWA(locHKV),    text: "Great initiative. Let's form a small committee. Volunteers please reply here." },
    ]},
    { loc: locRO3, creator: getCit(locRO3, 0), title: "Monsoon preparedness — drain cleaning schedule", msgs: [
      { author: getCit(locRO3, 0), text: "Can the RWA confirm when drain cleaning is scheduled before the monsoon?" },
      { author: getCit(locRO3, 1), text: "Last year it was done in late May. We should push for early May this year." },
      { author: getRWA(locRO3),    text: "Scheduled for 2nd week of May. I have confirmed with the sanitation department." },
    ]},
    { loc: locPTV, creator: getCit(locPTV, 0), title: "CCTV camera locations — resident input needed", msgs: [
      { author: getCit(locPTV, 0), text: "The main gate and the back lane are the most vulnerable points. CCTV is essential there." },
      { author: getCit(locPTV, 1), text: "Agree. The back lane has had two chain snatching incidents in the past month." },
    ]},
    { loc: locSBA, creator: getCit(locSBA, 0), title: "Street light complaint update", msgs: [
      { author: getCit(locSBA, 0), text: "No street lights for 5 nights now. This is unacceptable. What is the RWA doing?" },
      { author: getRWA(locSBA),    text: "We have filed a complaint with the electricity board. A technician is scheduled for tomorrow morning." },
      { author: getCit(locSBA, 1), text: "Thank you for the quick response. Please post an update once it's fixed." },
    ]},
  ];

  // Colony-level discussion
  const colDisc = await Discussion.create({ title: "Monsoon preparedness — colony-wide planning", locationId: colVK._id, tier: "colony", createdBy: offVK._id, messageCount: 2 });
  await Message.insertMany([
    { discussionId: colDisc._id, authorId: offVK._id, content: "Ahead of monsoon season, please report any blocked drains or low-lying water accumulation points in your sectors.", moderationStatus: "visible" },
    { discussionId: colDisc._id, authorId: getCit(locVKA, 0)._id, content: "Sector A has a blocked drain near the park gate. Reported it on the issues tab as well.", moderationStatus: "visible" },
  ]);

  // City-level discussion
  const cityDisc = await Discussion.create({ title: "City master plan feedback — share your neighbourhood needs", locationId: city._id, tier: "city", createdBy: cityOfficial._id, messageCount: 1 });
  await Message.create({ discussionId: cityDisc._id, authorId: cityOfficial._id, content: "The Commissioner's office is collecting feedback for the 2026 city master plan. Please share specific infrastructure needs from your colony.", moderationStatus: "visible" });

  // Create locality discussions
  for (const dt of discTemplates) {
    const disc = await Discussion.create({ title: dt.title, locationId: dt.loc._id, tier: "locality", createdBy: dt.creator._id, messageCount: dt.msgs.length });
    await Message.insertMany(dt.msgs.map(m => ({ discussionId: disc._id, authorId: m.author._id, content: m.text, moderationStatus: "visible" })));
  }

  console.log("💬 Created 8 discussions (6 locality + 1 colony + 1 city-wide)");

  console.log(`
🎉 Seed complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CITY level
  city@civicpulse.app          / official123  → sees EVERYTHING

MUNICIPALITY level  
  muni-south@civicpulse.app    / official123  → South Delhi (3 colonies)
  muni-north@civicpulse.app    / official123  → North Delhi (3 colonies)

COLONY level (6 admins)
  colony-vk@civicpulse.app     / official123  → Vasant Kunj Colony
  colony-hk@civicpulse.app     / official123  → Hauz Khas Colony
  colony-mn@civicpulse.app     / official123  → Malviya Nagar Colony
  colony-rohini@civicpulse.app / official123  → Rohini Colony
  colony-pit@civicpulse.app    / official123  → Pitampura Colony
  colony-sb@civicpulse.app     / official123  → Shalimar Bagh Colony

LOCALITY level — RWA Presidents (12, password: rwa123)
  rwa-vka@civicpulse.app  → Vasant Kunj Sector A
  rwa-vkb@civicpulse.app  → Vasant Kunj Sector B
  rwa-hkv@civicpulse.app  → Hauz Khas Village
  rwa-sda@civicpulse.app  → SDA Locality
  rwa-mna@civicpulse.app  → Malviya Nagar Block A
  rwa-mnb@civicpulse.app  → Malviya Nagar Block B
  rwa-ro3@civicpulse.app  → Rohini Sector 3
  rwa-ro7@civicpulse.app  → Rohini Sector 7
  rwa-ptv@civicpulse.app  → Pitampura TV Tower Block
  rwa-pts@civicpulse.app  → Pitampura Sainik Vihar
  rwa-sba@civicpulse.app  → Shalimar Bagh Block A
  rwa-sbb@civicpulse.app  → Shalimar Bagh Block B

CITIZENS (24, password: citizen123)
  citizen-vka1@, citizen-vka2@  → Vasant Kunj Sector A
  citizen-vkb1@, citizen-vkb2@  → Vasant Kunj Sector B
  ... (2 per locality, @civicpulse.app)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });