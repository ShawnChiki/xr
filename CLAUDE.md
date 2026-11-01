# Chiki XR: rules for every change to this repo

This repo is Sean's set of Quest-browser apps, served by GitHub Pages at https://shawnchiki.github.io/xr/.
The launcher (`index.html`) is how he sees what's new from the headset, so every push keeps it accurate.

## Every push

1. **Commit message first line = what's new, in plain words.** It is shown word for word on the launcher card
   and in the "Just changed" banner. Format: `<App name> vX.Y: <what changed, the part he'll notice first>`.
   Keep it to one readable sentence or two; extra detail goes in the commit body.
   One app per commit where possible, so each card shows its own change.
2. **New app → add a card to `index.html`** in the column that fits:
   - **Games**: something you play to win, race, chase or score (`.col.games`)
   - **Modeling Tools**: something you make geometry, terrain, lines or designs with (`.col.tools`)
   - **Toys & Sims**: open-ended play, simulations, things that run on their own (`.col.toys`)
   Card markup: `<a class="card" href="folder/"><b>App Name</b><span class="blurb">One line on what you do in it</span></a>`.
   Order inside a column doesn't matter; the page sorts newest first.
   If no column fits, ask Sean before adding a new one.
3. **Every app page loads `updated.js`** just before `</body>`:
   `<script src="../updated.js"></script>` for an app in its own folder, `<script src="updated.js"></script>` for a top-level `.html`.
4. **Times are Toronto time (ET).** `updated.js` handles this (`America/Toronto`); keep it that way.
5. Dates and "what's new" come from git history automatically. Never hand-write dates in the launcher.

## Launcher look

Memphis / postmodern: cream paper, thick black outlines, hard offset "slab" shadows, bright pink / yellow / teal / cobalt / violet,
confetti background, floating 3D shapes. Keep it informative and uncluttered: name, one-line blurb, when, what's new. No extra stats.
