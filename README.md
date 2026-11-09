<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1ccbce17-0897-4c4e-a4de-7e6c315ab27b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Netlify

1. Push this folder to a Git repo (or drag-and-drop is not enough: functions need a build, so use Git or the Netlify CLI).
2. In Netlify: **Add new site > Import from Git**. Build settings are read from `netlify.toml`.
3. Set the environment variable `GEMINI_API_KEY` (Site configuration > Environment variables).
4. Deploy. `/api/chat`, `/api/tts` and `/api/health` are served by Netlify Functions in `netlify/functions`.

CLI alternative: `npx netlify-cli deploy --build --prod`.

`server.ts` is only for local/AI Studio use and is not used on Netlify.
