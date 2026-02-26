# 72 hodin – Offline Poradce

A Progressive Web App (PWA) providing emergency crisis information and contacts for the city of Tábor, Czech Republic. Designed to work fully offline.

## Tech Stack

- **Language:** Vanilla JavaScript, HTML5, CSS3
- **Framework:** None (vanilla, no build step required)
- **Package Manager:** None
- **Offline Support:** Service Workers (`sw.js`, `sw.pwa3.js`) + Web App Manifest

## Project Structure

- `index.html` — Main app entry point
- `app.js` — Core app logic with fuzzy search engine
- `faq.json` — Emergency knowledge base
- `synonyms.json` — Search query expansion
- `city.config.json` — City-specific branding and contacts
- `manifest.webmanifest` — PWA configuration
- `sw.js`, `sw.pwa3.js` — Service workers for offline caching
- `cities/tabor/` — City-specific JSON data
- `assets/cities/tabor/` — City branding images
- `shared/` — Shared CSS and core JS utilities
- `v2/` — Alternative/newer app version
- `tabor/` — Standalone Tábor city version

## Running Locally

Served via Python's built-in HTTP server:
```
python3 -m http.server 5000 --bind 0.0.0.0
```

## Deployment

Configured as a **static** deployment with `publicDir: "."`.
