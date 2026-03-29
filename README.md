To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3000

For Cloudflare Workers local development:
```sh
bun run cf:dev
```

Required secrets:
- `OPENAI_API_KEY`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`

Example local secret file:
```dotenv
OPENAI_API_KEY=...
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
```

Create `.dev.vars` for local `wrangler dev`, and configure the same values as Secrets in the Cloudflare dashboard for production.
