This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Weather data

Local forecasts use the Open-Meteo Forecast API and its geocoding API through the
Next.js server routes. No weather API key or weather environment variable is
required. Select a place by name or grant browser location permission; forecasts
include current conditions, hourly and daily data, and 15-minute precipitation
when the model provides it for that location. Times are shown in the location's
time zone. Forecast data is model output, not live radar, and variable coverage
depends on location. Open-Meteo attribution is shown with the forecast.
Check Open-Meteo's current terms for the intended commercial use and deployment.

## Home date, occasions, and battery

The home status panel uses the device clock and formats both date and time in
`Asia/Kolkata`, following the selected Punjabi, Hindi, or English interface
language. Its bundled occasion list includes the fixed national public holidays
Republic Day, Independence Day, and Gandhi Jayanti, following the central
government's [holiday notifications](https://dopt.gov.in/notifications).
Lohri is shown separately as a cultural observance, not as an official public
holiday. This is intentionally not a complete annual Punjab holiday calendar:
variable lunar dates and additional state-notified holidays are not included,
and an unlisted date is described as having no listed major holiday rather
than as having no holiday.

Battery information is optional and is read only if the browser exposes
`navigator.getBattery()`. It needs no permission; the panel hides it when the
API is unsupported or access fails. Browser and operating-system support is
limited and inconsistent (notably unavailable in iOS Safari and some other
browsers), so it is never required for the home page to work.

## Agricultural updates

The home screen shows a compact preview; **View all updates** opens `/news`.
The server route `/api/news` reads the official [ICAR English RSS feed](https://icar.org.in/en/rss.xml), which was verified to return RSS with article titles, links and publication dates. It is a national research/news feed, not a Punjab advisory feed. Items are labelled `Punjab` only when the article title itself names Punjab/a Punjab place or a Punjab-relevant crop; other items are labelled `India`.
Only recent titles matching agricultural topics (including farming, crops, soil, pests, seeds, or agricultural training) are included; unrelated institutional announcements are filtered out.

The source publishes HTML descriptions which can include article body text and image markup. Since a blanket reuse licence was not established, this implementation deliberately uses only title, link and publication date. It does not copy excerpts or republish feed images. Category illustrations are local icons, not article photos. Headline language is preserved; the **Explain with AI** action sends the headline, publisher and original link through the existing chat flow and requests the selected response language.

The official [PAU weekly agro-advisory page](https://pau.edu/index.php?_act=manageSandesh&DO=viewAdvisory) is linked directly from the feed. It lists dated Punjabi and English bulletins, but provides no verified RSS feed or API. To avoid a fragile page scraper, the current feature does not ingest PAU bulletin rows; farmers open PAU's page for the current bulletin. The PAU page is refreshed weekly according to its listing, but this is not a guaranteed service interval.

PIB RSS was investigated, but its tested press-release feed provides titles and links without publication dates or descriptions, is not a verified Punjab-agriculture feed, and its content-reuse terms were not resolved; it is not included. GDELT's public DOC API is a discovery service, not an official advisory source, and live probes were rate-limited (HTTP 429), so it is also not used. Weather reports and price mentions in news are not presented as live weather or mandi data.

The feed refreshes on request at most every 20 minutes; concurrent refresh requests share the same in-flight fetch. Manual refreshes are limited to one attempt per minute. Feed bodies are limited to 1 MB, source fetches time out after 10 seconds, articles older than 120 days are filtered, and at most 40 normalized items are served. The 20-minute in-memory cache is retained as a stale fallback for up to 24 hours when a source fails. This cache is per Node.js process/container, does not survive restarts, and is not shared between multiple app instances. No database, API key or additional server configuration is required. If the cache is empty and the feed is unavailable, `/api/news` returns HTTP 502 and the UI shows a retry state.

## Ollama chat configuration

The chat API requires `OLLAMA_URL` in the server runtime environment. It must be
the Ollama base URL; the route appends `/api/chat`. The public app domain
(`https://ai.shelly22.online`) is the browser-facing frontend/API origin, not the
Ollama URL. The browser posts to the app's relative `/api/chat` route, and that
server route makes a separate request to Ollama.

For local development using the existing server-side backend, set `OLLAMA_URL`
in `apps/web/.env` or `apps/web/.env.local` to the Ollama base URL reachable by
the Next.js process:

```env
OLLAMA_URL=http://<VM_PUBLIC_IP>:11434
```

### Direct remote Ollama testing (development only)

The development UI also provides a **Direct remote Ollama (test)** mode. It
calls Ollama from the browser using `/api/tags` and `/api/generate`, lists
installed models, and streams responses directly into the chat. Configure its
public test endpoint locally:

```env
NEXT_PUBLIC_OLLAMA_TEST_URL=http://<VM_PUBLIC_IP>:11434
```

Restart the Next.js dev server after changing environment variables. This mode
is hidden in production builds and the endpoint value is public browser
configuration, not a secret. Direct browser access requires Ollama to allow the
local page origin (for example `http://localhost:3000`) with `OLLAMA_ORIGINS`.
It also requires network access to port 11434. Do not expose an unauthenticated
Ollama API to the whole internet: restrict inbound access to a trusted client IP
or use an authenticated HTTPS proxy. The direct testing mode is not a
production architecture.

When the app runs in Docker on the VM, use the Docker-reachable Ollama base URL
in `/etc/ollama-farmer.env` (for example, the host gateway address verified
from inside that deployment):

```env
OLLAMA_URL=<Docker-reachable Ollama base URL>
```

Keep this machine-specific setting in the VM environment file, not source
control. The deployment workflow passes this file to Docker at runtime. Do not
set `OLLAMA_URL` to `https://ai.shelly22.online`: that domain routes to the app's
`/api/chat` endpoint and would make the server call its own chat route instead
of Ollama.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Inter, a custom Google Font.

## Optional shared activity records

Users can opt in using the checkbox below the message box. Only opted-in chat
requests and the approximate coordinates of the currently selected weather
region are recorded. Coordinates are rounded to two decimal places; no account
name or IP address is added by this feature. A temporary anonymous browser
session code groups requests made in the same tab session. The checkbox is off
by default and can be turned off at any time. Records are visible to the app
owner, kept for up to 30 days, and stored in
`/var/lib/ollama-farmer/activity` on the VM. The log is capped at 20 MB.

Set `ACTIVITY_ADMIN_TOKEN` in `/etc/ollama-farmer.env` to a private random
secret of at least 32 characters (for example, generate one with
`openssl rand -hex 32`). Set `ACTIVITY_LOG_DIR` to
`/var/lib/ollama-farmer/activity`. The deployment workflow mounts that VM
directory into the app container so records survive container replacement.
Open `/admin/activity` and enter the token to review the latest 200 shared
requests. Keep the token private; the admin route does not use app accounts.
Activity records can only be viewed after the token is configured.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
