// The deck: index.html beside this file draws it, and exports it to PDF and PowerPoint.
// Replace this example with the deck you are writing; keep the shape (see the skill's SKILL.md).
window.DECK = {
  title: "Quarterly product review",
  lang: "en",
  theme: "ocean",
  footer: "Product review · Q3",
  author: "Product team",
  slides: [
    { layout: "cover", kicker: "Q3 REVIEW", title: "Retention grew because onboarding got shorter",
      subtitle: "What changed this quarter, what it cost, and what we do next", meta: "Product team · October",
      notes: "Open with the one result everyone should remember: retention is up, and we know why." },
    { layout: "agenda", title: "Today", items: ["Where we ended the quarter", "Why retention moved", "What it cost", "Next quarter's bets"],
      notes: "Four parts, about fifteen minutes. Questions at the end." },
    { layout: "section", kicker: "01", title: "Where we ended the quarter", subtitle: "Three numbers that matter",
      notes: "First, the results." },
    { layout: "stats", title: "Every headline number moved the right way",
      stats: [
        { value: "+18%", label: "30-day retention", note: "From 41% to 48% of new teams" },
        { value: "3.2 min", label: "Time to first preset", note: "Down from 11 minutes" },
        { value: "92", label: "Net promoter score", note: "Admins, n = 140" }
      ],
      takeaway: "Source: product analytics, July 1 – September 30",
      notes: "Retention is the one to remember. The other two explain it." },
    { layout: "chart", title: "Retention climbed as soon as the new onboarding shipped",
      chart: { type: "line", unit: "%", categories: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
        series: [{ name: "30-day retention", values: [40, 41, 41, 44, 47, 48] }] },
      takeaway: "The step comes in July, the month onboarding shipped.", note: "No pricing or marketing change in the same window.",
      notes: "Point at July. Nothing else changed that month." },
    { layout: "bullets", title: "Three changes did the work",
      bullets: [
        "A template picker replaced the blank preset form",
        { text: "Sign-in moved into the plugin", sub: ["No more copying codes between windows"] },
        "The first sync happens before the first question"
      ],
      aside: { value: "-70%", label: "time from install to first useful answer" },
      notes: "Each removed a step where people used to stop." },
    { layout: "process", title: "A new admin now reaches value in four steps",
      steps: [
        { title: "Create the team", text: "The assistant preset is there from the start." },
        { title: "Add a model", text: "One key, checked on save." },
        { title: "Pick a template", text: "Writer, analyst, researcher or presenter." },
        { title: "Invite members", text: "They sync on first sign-in." }
      ],
      notes: "Walk through it as an admin would." },
    { layout: "two-column", title: "It cost less than planned, and one thing slipped",
      left: { heading: "On budget", bullets: ["Two engineers for six weeks", "No new infrastructure", "Docs written alongside"] },
      right: { heading: "Slipped", bullets: ["Phone onboarding moves to Q4", "Template analytics are still manual"] },
      notes: "Be straight about what slipped." },
    { layout: "table", title: "Templates differ most in how long sessions last",
      columns: ["Template", "Teams using it", "Median session", "Kept after 30 days"],
      rows: [["Writer", "212", "14 min", "71%"], ["Analyst", "158", "22 min", "64%"], ["Researcher", "97", "31 min", "58%"]],
      highlight: 3,
      notes: "Writer is the most kept; research sessions are the longest." },
    { layout: "quote", quote: "We set up the team in the time it took to make coffee.", by: "Admin at a 40-person studio",
      notes: "Let the quote land. Pause." },
    { layout: "chart", title: "Next quarter's time goes mostly to phones",
      chart: { type: "doughnut", categories: ["Phone onboarding", "Template analytics", "Reliability"], series: [{ name: "Share of time", values: [50, 30, 20] }] },
      takeaway: "Half of Q4 goes to the slipped phone work.",
      notes: "This is the ask: agree the split today." },
    { layout: "closing", title: "Decision needed today", subtitle: "Agree the Q4 split: phones 50%, analytics 30%, reliability 20%", contact: "product@example.com",
      notes: "Stop here and ask for the decision." }
  ]
};
