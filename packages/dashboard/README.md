# Grove Bloom Dashboard

Mobile-first SvelteKit dashboard for controlling Bloom sessions.

## Features

- Start/stop Bloom sessions
- Region selection (EU/US)
- Real-time terminal view (ttyd embed)
- Session history and cost tracking
- Project selector
- Quick task submission
- Settings management

## Tech Stack

- **Framework**: SvelteKit 2+ (Svelte 5 runes)
- **Deployment**: Cloudflare Pages
- **Auth**: Heartwood (GroveAuth)
- **Styling**: TBD (following GroveEngine patterns)
- **WebSocket**: Terminal proxy via Worker

## Structure

```
src/
├── routes/
│   ├── +layout.svelte           # Main layout
│   ├── +page.svelte              # Main view (offline/running)
│   ├── settings/
│   │   └── +page.svelte          # Settings view
│   └── api/
│       └── [...proxy]/           # API proxy to worker
├── lib/
│   ├── components/               # Reusable components
│   │   ├── Terminal.svelte       # ttyd embed
│   │   ├── StatusBadge.svelte    # Server status indicator
│   │   └── SessionHistory.svelte # Session list
│   ├── stores/                   # State management
│   │   ├── session.ts            # Current session state
│   │   └── config.ts             # User config
│   └── api/                      # API client
│       └── bloom.ts              # Worker API calls
└── app.html                      # HTML template
```

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Environment Variables

Required for deployment:

```env
# Set in Cloudflare Pages settings
PUBLIC_WORKER_URL=https://bloom.grove.place/api
PUBLIC_AUTH_URL=https://auth.grove.place
```

## API Integration

Dashboard communicates with `bloom-control` worker via `/api/*` endpoints.

See `docs/grove-bloom-spec.md` for full API specification.
