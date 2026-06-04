# Nexus — Multi-Agent Relationship Intelligence

A conversational AI agent that lets sales reps query their contact network in natural language — without opening Salesforce.

Built with Claude, Python, and a 6-agent orchestrator. AI Native Sprint · Altify · May 2026.

## Live site

Deployed at: `https://YOUR-USERNAME.github.io/nexus`

## Screens

| Screen | Description |
|---|---|
| [index.html](index.html) | Landing page |
| [screen-01-setup.html](screen-01-setup.html) | Agent Setup — configuration form, RAI checklist |
| [screen-02-chat.html](screen-02-chat.html) | Live Chat — calls Claude API directly from browser |
| [screen-03-handoff.html](screen-03-handoff.html) | Handoff State — confidence tiers, gap log, export |
| [screen-04-edge-cases.html](screen-04-edge-cases.html) | Edge Cases — 4 states where the agent reaches its limits |

## How to use the live chat

1. Open `screen-02-chat.html`
2. Enter your Anthropic API key when prompted (get one at [console.anthropic.com](https://console.anthropic.com))
3. Type a query — your key is used only in your browser session, never stored

## Deploy to Netlify (Option B — server-side key)

Connect this repo to Netlify and add `ANTHROPIC_API_KEY` as an environment variable. The `netlify.toml` and `netlify/functions/` files handle the rest automatically.

## Local development

Open any HTML file directly in Chrome. No build step needed.

For the Python multi-agent backend (Option C), see [nexus-live.zip](https://github.com/YOUR-USERNAME/nexus).

---

Dan Quinn · Altify · AI Native Sprint · May 2026
