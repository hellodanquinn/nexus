exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify({
    status:      "ok",
    api_key_set: !!process.env.ANTHROPIC_API_KEY,
    model:       "claude-sonnet-4-20250514",
    environment: "netlify",
    timestamp:   new Date().toISOString(),
  }),
});
