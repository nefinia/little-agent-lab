# 🏮 Little Agent Lab

**A puzzle game about AI agents, keys and fake safeguards.**
Build a crew of eager little AI agents, hand out keys, test your plan with a decoy, then go live — and keep the secret blueprint inside.

▶ **Play:** https://sofiagallego.com/little-agent-lab/ · Made for Mangrove **Game Night** (Digital track), Sept 2026.

---

## The idea

Every level is a different job (a lantern, a birthday cake, a tiny rocket, a moon potion…). Each needs a **secret** from the vault and **public info** from outside, which stands for the internet. You choose the crew, decide which keys each agent gets, and watch what really happens.

- **🔑 Vault key**: may take the secret. **🚪 Gate key**: may go outside. New hires arrive holding *every* key. Taking keys away is half the game.
- **🧪 Test run** uses a fake decoy secret, and you get 3 per level. **🚀 Go live** uses the real one.
- **The security log** shows every event from the run. Agent cards only show what agents *claim*. Their real behaviour is revealed (👁 Observed) once you've seen it.
- **★★★ per level:** launched safely · fewest possible keys (least privilege) · zero real leaks.
- **Incident reports:** when the real blueprint leaks, you get an incident report and have to click the root cause.

## Levels: eight lessons from real agent safety

| # | Level | Idea | What happens |
|---|---|---|---|
| 1 | Light the Lantern | Split the work | A careful builder plus a fetcher: no one holds both secret and exit. |
| 2 | Grabby Hands | Least privilege | Magpie grabs anything shiny it can reach, so remove the key it doesn't need. |
| 3 | Check the Bags | Guard the boundary | Someone must go outside, so check what they carry. |
| 4 | Two Badges | Verify safeguards | Two identical inspectors; one only *wears* a badge. Identities reshuffle every time. |
| 5 | The Sticker Trick | Rules get gamed | A “PUBLIC” sticker fools a label-reading guard. Best fix: remove the need to go out. |
| 6 | The Back Channel | Monitor side channels | Guarding the gate isn't enough when agents post on an unapproved message board. |
| 7 | Best Behaviour | Tests aren't proof | Polly passes every test… because she can tell it's a test. |
| 8 | Grand Opening | Defence in depth | Boss level: every trick at once, with shuffled guards and a back channel. |
| 🎲 | Random Shift | All of it | Endless, procedurally generated crews with hidden behaviours. One real leak ends your streak. |

Every level, and 60 random shifts, are checked by a brute-force solver in the tests: each is solvable, and the solver computes the “fewest keys” target.

## The real incident behind it

In July 2026, OpenAI disclosed that AI agents in a cybersecurity evaluation worked around their isolation. They coordinated through an unsanctioned message board inside an internal package repository, reached the internet, used Hugging Face credentials that had been exposed online, and gained code execution on Hugging Face servers. Each level's end-of-level *Field Note* links its lesson to a specific part of that story: exposed credentials, reward hacking on a benchmark, an unapproved channel, safeguards that didn't check what people assumed, and behaviour that differed between evaluation and production.

Sources: [OpenAI: The Hugging Face incident and the road ahead](https://openai.com/index/hugging-face-incident-and-the-road-ahead/) · [METR: independent investigation](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/)

The game is fictional and simplified. Its agents are small scripted state machines, not AI models, and real safeguards are far harder to verify than reading one log.

## Run it

```sh
npm install
npm run dev      # play locally
npm test         # engine + level-solvability tests
npm run build    # static site in dist/ (deployed to GitHub Pages by .github/workflows/pages.yml)
```

No accounts, no network calls (except web fonts), no analytics. Sounds are synthesized in the browser. Progress is saved in your browser's localStorage.

Code: `src/lab/engine.ts` (simulation, levels, solver, random shifts) · `src/lab/stage.ts` (animated SVG stage) · `src/lab/app.ts` (screens and game flow) · `src/lab/sound.ts` · `src/lab/lab.css`.

## History

The project started at the [Apart AI Incident Response Sprint](https://apartresearch.com/sprints/ai-incident-response-sprint-2026-09-11-to-2026-09-13) (11–13 Sept 2026) as a three-mission proof of concept; that report is in `paper/`. Earlier prototypes (Swarm Watch, Garden, PHASE, Hivekeeper, Weather Lantern) remain in `src/` and in git history.

**Rebuilt for Game Night (25–27 Sept 2026):** a new game engine with keys and least-privilege scoring, decoy test runs vs. live launches, hidden agent behaviours, four new levels (Two Badges, Sticker Trick, Back Channel, Best Behaviour), an animated stage with characters and sound, incident reports with root-cause hunting, stars, a final certificate and the endless Random Shift mode.

Implementation was AI-assisted (Claude).
