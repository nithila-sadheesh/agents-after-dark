# FoWorld — Give Fo a Body

*Fo handles the calls. We handle the miles.*

FoWorld is a physical-execution layer for Wajo's Fo agent. You describe an errand in natural language.
- **Fo** (the real Wajo agent, reached over MCP) researches and coordinates the business.
- **Claude** (`claude-opus-5-5`, structured output) turns the request into a validated robot action plan.
- A deterministic simulator runs that plan step by step in an interactive Three.js neighborhood.

## Run

```bash
npm install
# .env needs ANTHROPIC_API_KEY=... (PORT=8787)
npm run fo:login   # one-time Wajo OAuth sign-in in the browser; tokens go to .fo-auth.json (gitignored)
npm run dev        # web on http://localhost:5173, API on :8787
```

- **Chat (live):** type a request, e.g. "Get my clothes dry-cleaned", or click a suggestion.
  - A genuine Fo request is sent. Fo's progress and reply show in the activity feed tagged **LIVE**.
  - Claude plans the robot run in about 4s.
  - After about 25s the robot proceeds while Fo keeps researching. Fo replies can take several minutes.
- **Presentation mode:** a one-click, roughly 60s offline demo with scripted Fo activity and no network calls.
- Without Fo tokens or the Claude key, the app continues with the fallback plan.

### Real end-to-end mode (`FO_LIVE_ACTIONS` in `shared/config.ts`, currently `false`)

- **Off (default, what the demo runs):** Fo researches only, with no calls, bookings, or payments. Approve is local, and the robot leaves after about 25s while Fo keeps working, because Fo replies can take minutes.
- **On:** Fo is asked to call the business and book the robot drop-off, then wait for approval before paying. A human's **Approve** click sends the authorization to Fo on the same conversation (`POST /api/fo/approve`, capped by `FO_SPEND_CAP_USD`). The robot is dispatched **only after Fo confirms the booking**. This needs a Wajo account with payment details.

## Architecture

```
src/ui      floating React/Tailwind overlay (chat, task card, activity feed, approval, inspector)
src/world   R3F scene: procedural component library + SceneRenderer(SceneSpec JSON), camera rig
src/sim     orchestrator (Fo + Claude + approval) and plan executor (waypoint routing, events)
server      Express: POST /api/plan (Claude), /api/fo/{ask,reply,status} (Fo MCP + OAuth)
shared      contracts: types, waypoint graph, plan/scene validation, API shapes
```

Robot language: `MOVE_TO`, `PICK_UP`, `DROP_OFF`, `WAIT`, `RETURN_HOME`, `REPORT_STATUS`. Every AI-generated plan is validated
against this schema (known actions, resolvable targets, pickup/drop-off order) before it runs. Claude never emits code.
