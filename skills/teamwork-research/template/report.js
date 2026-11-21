// The report: index.html beside this file draws it, prints it to PDF and saves it as Markdown.
// This example is illustrative: its sources are placeholders on example.org. Replace it with the report you are
// writing and keep the shape (see the skill's SKILL.md).
window.REPORT = {
  title: "Buy a hosted search service rather than run our own",
  kicker: "Vendor selection",
  subtitle: "Three options compared on cost, effort and risk for a 40-person product team",
  lang: "en",
  author: "Research analyst",
  date: "2026-11-21",
  question: "Should the support team run its own search cluster or buy a hosted service for the help centre?",
  summary: {
    answer: "Buy the hosted service: it costs about the same as running our own at our size and removes the on-call work [1][3].",
    points: [
      "At 2 million documents the hosted plan is $1,150 a month against roughly $1,000 of servers for our own cluster [1][2].",
      "Running our own adds about a fifth of an engineer for upgrades and incidents [4].",
      "Both meet the 200 ms search target in published benchmarks [2][5]."
    ],
    recommendation: "Start the hosted trial now and review cost at 5 million documents, where the gap widens [1].",
    confidence: "medium",
    confidenceWhy: "Prices come from the vendors' own pages; the effort estimate rests on one survey [4]."
  },
  metrics: [
    { value: "$1,150", label: "Hosted, a month", note: "2M documents", source: 1 },
    { value: "~0.2 FTE", label: "Own cluster upkeep", source: 4 },
    { value: "< 200 ms", label: "p95 search, both", source: 5 }
  ],
  scope: {
    asOf: "2026-11-20",
    subQuestions: [
      "What does each option cost at 2 and 5 million documents?",
      "How much engineering time does each take to run?",
      "Does each meet our 200 ms search target?"
    ],
    included: ["Hosted service A", "Self-run open-source engine", "Database full-text search"],
    excluded: ["Vector-only search", "Pricing negotiated outside public plans"],
    method: "Vendor pricing and documentation pages, one public benchmark and one practitioner survey; every figure was read from its source on the access date."
  },
  sections: [
    {
      title: "Cost is close at our size and diverges later",
      lead: "Monthly cost for the help centre's index, list prices.",
      blocks: [
        { type: "table", columns: ["Option", "2M documents", "5M documents", "Notes"],
          rows: [
            ["Hosted service A", "$1,150 [1]", "$2,600 [1]", "Includes replicas and backups"],
            ["Self-run engine", "~$1,000 [2]", "~$1,700 [2]", "Three servers; staff time not included"],
            ["Database full-text", "$0 extra [3]", "$0 extra [3]", "Uses the existing database"]
          ],
          highlight: 1, caption: "Server cost for the self-run engine uses the vendor's sizing guide [2]." },
        { type: "text", text: "Database full-text search costs nothing extra but lacks typo tolerance and relevance tuning, which the help centre relies on [3]." }
      ]
    },
    {
      title: "Running our own costs engineering time",
      blocks: [
        { type: "text", text: "Teams running the engine themselves report spending about a fifth of an engineer on upgrades, capacity and incidents [4]." },
        { type: "callout", kind: "risk", text: "Major upgrades of the self-run engine have required a full reindex in each of the last two releases [2]." },
        { type: "quote", text: "Search was the one service that woke us up at night until we moved it to a vendor.", source: 4 }
      ]
    },
    {
      title: "Both meet the speed target",
      blocks: [
        { type: "bullets", items: ["Hosted service A: p95 of 120 ms at 2M documents [5].", "Self-run engine: p95 of 150 ms on the recommended servers [5]."] },
        { type: "callout", kind: "gap", text: "No benchmark covers our mix of Chinese and English articles; the trial should measure it." }
      ]
    }
  ],
  gaps: [
    "Volume discounts above 5 million documents are not published.",
    "The effort estimate comes from one survey of 60 teams [4]; no second source was found."
  ],
  sources: [
    { id: 1, title: "Hosted Service A pricing", publisher: "Vendor A", url: "https://example.org/vendor-a/pricing", date: "2026-10", accessed: "2026-11-20", kind: "primary", quote: "Growth plan: $1,150 per month for up to 2 million records, including replicas and daily backups." },
    { id: 2, title: "Self-run engine sizing and upgrade guide", publisher: "Engine project", url: "https://example.org/engine/docs/sizing", accessed: "2026-11-20", kind: "primary", quote: "Major version upgrades require reindexing all documents." },
    { id: 3, title: "Full-text search in the database manual", publisher: "Database project", url: "https://example.org/db/docs/full-text", accessed: "2026-11-20", kind: "primary", quote: "Full-text search ranks by term frequency; it does not correct misspellings." },
    { id: 4, title: "State of search operations survey 2026", publisher: "Practitioner newsletter", url: "https://example.org/survey-2026", date: "2026-06", accessed: "2026-11-20", kind: "secondary", note: "60 teams; self-reported", quote: "Respondents running their own cluster spent a median 0.2 FTE on operations." },
    { id: 5, title: "Search latency benchmark, 2M documents", publisher: "Independent benchmark", url: "https://example.org/bench/search-2026", date: "2026-09", accessed: "2026-11-20", kind: "data", quote: "p95 query latency: Service A 120 ms, self-run engine 150 ms (2M documents)." }
  ]
};
