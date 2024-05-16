we all need more reasons to celebrate.

## Setup

```sh
npm install
# add credentials; it's all a bit arbitrary given that these are client side anyway.
# I store them in 1password, and keep separate per-env files:
# - .env.development.local
# - .env.production.local
cp .env.local.template .env.local && $EDITOR .env.local
```

## Run

```sh
npm run dev # | build | preview | test
```

## Things for a v1 (ordered)
- Include instructions for importing (make a video with sesame street characters)
- Deploy
- Scrub credentials from git repo
- Remove extra authorization access for localhost.

## Out of scope:
- Edit imported data?
- cache data using IndexedDB.
- Add confetti animation IF it's your anniversary today
