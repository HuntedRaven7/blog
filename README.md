![Logo](https://github.com/markdownium.png)
# Markdownium

A blazingly fast, minimal wiki engine that doesn't suck.

## Features

- **Client-side rendering** - No server-side processing required
- **Hash-based routing** - Clean URLs like `/#/page` and `/#/page#header` (just like [Holo.js](https://holo.js.org))
- **Syntax highlighting** - Code blocks with Highlight.js
- **Dark theme** - Modern minimal design
- **Responsive** - Mobile-friendly layout
- **XSS protection** - Safe content rendering
- **Auto header IDs** - Clickable headers for deep linking
- **Smooth scrolling** - Navigate to sections seamlessly
- **RSS & Atom feeds** - Subscribe to content updates
- **Fuzzy search palette** - Hit `Ctrl+K` or the header search button to fuzzy-search pages and headings
- **Now Playing** - Embedded YouTube player for playlists
- **Copy buttons** - One-click copy on code blocks
- **Reading progress** - Scroll progress bar and back-to-top button
- **Page stats** - Per-page view counter plus a last-updated / reading-time line under each title
- **Visitor counter** - Sidebar widget counting site visitors (once per session) via the free countapi service
- **Activity graph** - GitHub-style contribution grid in the sidebar showing your daily blog activity (recorded whenever content files change)

## Setup

1. Copy `config.json.def` to `config.json`
2. Configure your settings
3. Place Markdown files in `content/` directory
4. Serve with any static web server, or use the bundled Node.js server for feed support:

```bash
npm install
npm start
```

## Configuration

```json
{
  "siteName": "Your Wiki Name",
  "logo": "https://example.com/logo.png",
  "baseUrl": "http://raw.githubusercontent.com/USERNAME/REPO/refs/head/main",
  "licenseBadge": "<a href=\"license-url\"><img src=\"badge-url\"></a>"
}
```

## Content

- Create `.md` files (duh)
- `home.md` is the default page
- `sidebar.md` for sidebar navigation
- `top.md` for top navigation links
- Internal links: `[Text](/#/page-name)` or `[Text](/page-name)`

## Deployment

Deploy to any static hosting service - GitHub Pages, Netlify, Vercel, etc. No server requirements beyond serving static files.

### Development Server with Feeds

To enable RSS and Atom feeds locally:

```bash
npm install
npm start
```

The server will be available at `http://localhost:3000` with feeds at:
- RSS: `http://localhost:3000/feed.rss`
- Atom: `http://localhost:3000/feed.atom`

### Feed Content

Posts are generated from `.md` files in `content/`. Special files (`sidebar.md`, `top.md`, `home.md`) are excluded from feeds. The title is extracted from the first `# heading` in each file, or falls back to the filename. Publication date is derived from the file modification time.

### Activity Graph

The sidebar activity widget reads `activity.json`. It takes no build dependencies — activity is recorded whenever you change files under `content/` and rebuild:

```bash
npm run build:feeds
```

Or just the activity file:

```bash
npm run build:activity
```

Each build stores your content files' modification times as daily contributions, so the grid fills in over the days you actually touch the blog.
