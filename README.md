# Good News Everywhere

Wholesome news from around the world, pinned to a map.

## Run it

    node scripts/fetch-news.mjs          # gather stories from the RSS feeds into data/stories.json
    ADMIN_TOKEN=pick-a-secret node server.mjs   # serve the site on http://localhost:8080

Needs Node 18+. No dependencies to install.

## Pages

- `/` the map, today's pick, mood picker, feed and story form
- `/digest.html` seven stories from the past week, printable
- `/admin.html` review queue for community stories (needs `ADMIN_TOKEN`)

## How it works

- `scripts/fetch-news.mjs` reads the feeds, sorts each story into a topic by keywords and finds a place with `scripts/places.mjs`.
- `server.mjs` serves only the public files, stores submissions in `data/submissions.json` (not committed) and publishes the ones you approve.
- Without the server (for example opening the files from a plain static host), the story form saves to the visitor's own browser instead.
