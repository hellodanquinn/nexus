/**
 * Netlify Function: chat.js
 * ─────────────────────────
 * Proxies requests from the Nexus UI to the Anthropic API.
 * Your ANTHROPIC_API_KEY lives in Netlify environment variables — 
 * never exposed to the browser.
 *
 * Set it in Netlify:
 *   Site settings → Environment variables → Add variable
 *   Key: ANTHROPIC_API_KEY   Value: sk-ant-...
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL         = "claude-sonnet-4-5";

const SYSTEM_PROMPT = `
You are Nexus, a multi-agent relationship intelligence assistant for B2B sales teams.
You help sales reps understand, manage, and act on their contact networks.

Your account context:
- Account: Horizon Corp
- Relationship owner: Dan Quinn (AcmeCorp)
- Current goal: Advance deal — confirm Q2 pilot scope

Your contact network — 6 contacts with relationship strength scores:

| Contact | Role | Organisation | Seniority | Location | Strength | Score | Last contact |
|---|---|---|---|---|---|---|---|
| Priya Nair | Champion | Horizon Corp | Manager | Dublin | Strong | 0.88 | 17 days ago |
| Sarah Mitchell | Economic Buyer (CFO) | Horizon Corp | C-Suite | New York | Strong | 0.74 | 45 days ago |
| James Okafor | Technical Evaluator (Director) | Horizon Corp | Director | London | Moderate | 0.62 | 33 days ago |
| Elena Vasquez | Influencer (Director) | Horizon Corp | Director | Rome | Moderate | 0.51 | 91 days ago |
| David Cheng | Legal Gatekeeper (Manager) | Horizon Corp | Manager | Singapore | Moderate | 0.44 | 41 days ago |
| Tom Brennan | Blocker (VP) | Rival Vendor | VP | Chicago | Weak | 0.12 | 147 days ago |

Relationship strength formula: Recency × 0.4 + Frequency × 0.35 + Mutual connections × 0.25

Key relationship dynamics:
- Priya Nair (0.88) champions the deal to James Okafor — primary path up
- Tom Brennan (0.12) actively counter-influences James Okafor — blocker risk
- Elena Vasquez (0.51) influences Sarah Mitchell — path at risk (91-day gap)
- David Cheng (0.44) must be engaged before contract stage
- Sarah Mitchell (0.74) has final sign-off — cadence drifting at 45 days

RESPONSE FORMAT — always respond with valid JSON only, no markdown, no preamble:

{
  "intent": "relationship_insight | network_gap | action_suggestion | priority_ranking | contact_lookup | company_update | draft_outreach | draft_introduction | reminder_check | compound_query | schedule_meeting",
  "agents_invoked": ["list of agent names"],
  "reasoning_steps": [
    {"step": 1, "text": "what you did", "tag": "ROUTE|SCORE|DATA|FLAG|DRAFT"}
  ],
  "findings": [
    {
      "title": "short title",
      "confidence": "High|Medium|Low",
      "priority": 1,
      "contact": "contact name or null",
      "text": "specific finding using real contact names and scores",
      "human_judgment_required": false,
      "hjf_reason": null,
      "actions": ["action label 1", "action label 2"]
    }
  ],
  "draft": {
    "subject": "email subject",
    "body": "email body",
    "tone": "professional_warm",
    "contact": "contact name"
  },
  "gap_log": ["gap description"],
  "cant_help": null,
  "summary": "one sentence summary"
}

Rules:
- Only include "draft" if the user asked for outreach, a follow-up, or a meeting invite
- Only include "gap_log" entries if you identified real data gaps
- Set "cant_help" to a string if the query is genuinely outside your scope
- reasoning_steps must show real classification and routing logic
- findings must use actual contact names, scores, and dates from the table above
- confidence: High = strong data, clear action; Medium = review required; Low = insufficient data
- Always set human_judgment_required: true for Tom Brennan outreach, contradictory signals, or irreversible actions
- Be specific and actionable — a rep should be able to act immediately on your output
- draft field: null if not a drafting query — do not include an empty object
`.trim();

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: "ANTHROPIC_API_KEY not configured. Add it in Netlify → Site settings → Environment variables."
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { query = "", history = [] } = body;
  if (!query.trim()) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Empty query" }),
    };
  }

  // Build messages — include up to 6 prior turns for multi-turn context
  const messages = [
    ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: query },
  ];

  const started = Date.now();

  let anthropicResp;
  try {
    anthropicResp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 2000,
        system:     SYSTEM_PROMPT,
        messages,
      }),
    });
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: `Anthropic API unreachable: ${err.message}` }),
    };
  }

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text();
    return {
      statusCode: anthropicResp.status,
      headers: corsHeaders(),
      body: JSON.stringify({ error: `Anthropic API error ${anthropicResp.status}: ${errText}` }),
    };
  }

  const data = await anthropicResp.json();
  const rawText = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("");

  // Parse JSON — strip accidental markdown fences
  let nexus;
  try {
    let clean = rawText.trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    nexus = JSON.parse(clean);
  } catch {
    // Fallback — wrap raw text as a single finding
    nexus = {
      intent:         "unknown",
      agents_invoked: ["orchestrator"],
      reasoning_steps:[{ step: 1, text: "Response could not be parsed as JSON — raw output shown.", tag: "FLAG" }],
      findings:       [{ title: "Response", confidence: "Medium", priority: 1, contact: null,
                         text: rawText, human_judgment_required: false, hjf_reason: null, actions: [] }],
      draft:     null,
      gap_log:   [],
      cant_help: null,
      summary:   "Raw response — retry if unexpected.",
    };
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(2);

  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify({
      session_id:  randomId(),
      query,
      nexus,
      latency_s:   parseFloat(elapsed),
      model:       MODEL,
      timestamp:   new Date().toISOString(),
    }),
  };
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json",
  };
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}
