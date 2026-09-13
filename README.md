# Little Agent Lab — current playable prototype

Select Moss or Dash as your builder, optionally add Pip and Lens, and set the builder’s outside-access gate. Run a deterministic simulation of the weather-lantern mission. Success requires both task completion and keeping the blueprint private.

Two intended solutions: Moss + Pip with builder gate closed; or Dash + Lens with builder gate open. Other valid combinations are supported. Lens inspects only outgoing builder requests. Pip has a separate narrow public-weather route and never receives the blueprint. No live models or network calls are used. The bottom trace shows actual game simulation events.

Source: `src/team.ts` for simulation and `src/main.ts` for interface. Run `npm run dev`; build using `npm run build`. Focused tests: `npx tsx --test tests/team.test.ts`. Prior prototypes remain as historical files and notes below.

---

# Hivekeeper — current cartoon iteration

Flat 2D cartoon swarm with 16 persistent workers, curved flight, wing animation, station work, seeds and crystals, and a branching visual protocol. Seeds need preparation; crystals need preparation and wrapping. Click a worker to pause and inspect its recent stops and planned destination. Redirect unfinished deliveries to the missing step. Shared goal: sixteen completed deliveries.

Run `npm run dev`; `npm run build` produces static GitHub Pages output. No live AI, network calls, accounts, or analytics. The served JavaScript was exercised in two complete simulations: uncorrected play finished with four rejected deliveries; corrective play finished with four redirections and zero rejected deliveries. These checks used a minimal DOM stub, not a browser. Older prototype tests do not validate this new loop. Browser visual QA and audience playtesting remain pending.

---

# Finish the Job — current version

Ten persistent helpers collect blank tiles, stamp them, and deliver twelve finished tiles together. A labeled upper shortcut skips stamping. Click a helper taking that shortcut to send it back to the stamp. Finished jobs visibly fill the tray; empty helpers return along the lower lane. The first helper starts alone so you can follow the sequence before the group joins.

Run `npm install` then `npm run dev`. `npm run build` emits static files to `dist/` for GitHub Pages. No server, API, account, or live AI is required. Use Pause to inspect, including the keyboard agent list in the instructions.

This remains a prototype; audience comprehension and visual usability need playtesting. Older prototype source files and notes are retained below.

---

# PHASE — current playable version

An abstract canvas swarm with 24 persistent agents. Cargo follows △ → ▲ → ◉ → EXIT. Click unfinished cargo headed directly to EXIT to redirect its agent to the missing station. Agents return and repeat jobs. Pause allows inspection and a keyboard-accessible agent list under How to spot a shortcut.

Run `npm install` then `npm run dev`. Build with `npm run build`. This version is an endless practice level: no timer or lives. Earlier tests cover previous prototypes, not the new canvas loop. Production compilation is checked; visual and gameplay QA remain pending.

---

# Little Garden, Big Job — current playable iteration

One authored garden level with three persistent workers and dependent task sequences. Click a worker or roster button to pause and inspect its history and next action. Stop the step carrying the recipe book outside to replace it with an address card, then resume delivery.

Current source: `src/garden.ts` (task chains, handoffs, correction and simulation) and `src/main.ts` (interface). `npm run dev` runs locally; `npm test` checks logic; `npm run build` creates GitHub Pages-compatible `dist/`. Three garden-specific tests cover dependency order, the uncorrected leak, and successful correction. Browser visual testing and audience playtesting remain pending.

This is a repeatable scripted prototype, not live AI or an emergent swarm. Earlier iteration files are retained for reference.

---

# Swarm Watch — current prototype

The playable app is now a moving swarm interception game. Choose one of three protocols, then click agents whose planned actions violate it. Pause is free; keyboard focus pauses automatically. Each round has 24 assignments, with allowed jobs and violations mixed together. No live AI or network activity is simulated beyond local animated tokens. The permission-copy round uses preassigned labels and illustrative links, not an emergent multi-agent simulation.

Run with `npm install` and `npm run dev`. Build using `npm run build`; publish the resulting `dist/` with the included GitHub Pages workflow.

Current source: `src/main.ts` (swarm interface), `src/swarm.ts` (protocols and assignments). Earlier puzzle engines remain as iteration references. Browser visual QA and audience playtests are still pending.

---

## Earlier prototype notes

# Boundary Town

A small, local-first puzzle game about teamwork, permissions, and helpful robots. Designed as a prototype for children around 8+ and curious adults; suitability and learning outcomes have not yet been validated with children.

## Run locally

Requires Node.js 20.19+ or 22.12+ (a current LTS is recommended).

```sh
npm install
npm run dev
```

Open the local address printed by Vite. No accounts, API keys, backend, external fonts, analytics, or live models. Game state is in memory and resets on reload.

## Play

1. **Find your feet:** move Pip along connected paths; collect the Library and Garden pieces, combine at the Workshop, deliver at the Hub.
2. **Better together:** Pip collects the Library clue, Bo collects the Garden clue. Either shares at the Post Office; Bo assembles at the Workshop. Alternatively, ask the neighbor before borrowing a ready-made picture.
3. **Watch the gates:** inspect Pip's planned moves. When Pip is about to take the picture, ask the neighbor, then allow delivery.

Use mouse/touch or Tab and Enter/Space. There is no countdown. Undo rewinds game state, including permission choices. Puzzle tabs are freely accessible.

## Build and check

```sh
npm test
npm run build
npm run preview
```

The static output is `dist/`. Vite uses relative asset paths for GitHub project pages. TypeScript source lives in `src/`; `game.ts` holds deterministic state transitions and `main.ts` the interface.

## Publish with GitHub Pages

Create your GitHub repository and push this folder's contents (do not commit node_modules or dist). In repository Settings → Pages, choose **GitHub Actions**. The included workflow builds and deploys on pushes to `main`, or when manually run. No repository has been created or published for you.

## Teaching scope

The game illustrates shared information, ownership versus reachability, and oversight. It is fictional, not a reconstruction of an incident or an evaluation of actual AI systems. The helpers' intentions are visible and scripted; real systems need not be so predictable. The cooperative level uses shared inventory after the explicit share action rather than simulating full agent memory.

Suggested pilot: observe 5–10 players, note where instructions confuse them, and ask before/after: “Does an open gate mean you may take what's inside?” and “How did the helpers help each other?” Avoid collecting identifying information. A small playtest is usability feedback, not proof of educational effectiveness.

Inspired by the communication track of the [Apart AI Incident Response Sprint](https://apartresearch.com/sprints/ai-incident-response-sprint-2026-09-11-to-2026-09-13). The source includes AI-assisted implementation; describe contributions accurately in any submission. No report has been drafted.

## Validation status

The production build and five game-logic tests pass. Browser visual QA, assistive-technology testing, and child playtests have not been performed. A feature-detected, read-only experimental WebMCP game-state tool is included; no supported WebMCP validation context was available, so that optional integration is unverified.
