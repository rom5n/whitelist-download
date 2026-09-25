# Project Overview
Whitelist-download is an automatic VLESS config aggregator and local subscription server. It downloads free VLESS configs from GitHub sources, de-duplicates them, checks that they work, tags them with a country (GeoIP), and serves them as one subscription link from a local HTTP server. A React dashboard is embedded in the Go binary for monitoring and management. The app runs as a system-tray application on Windows, Linux and macOS. Tech stack: Go (backend, single module at the repo root) and React + TypeScript + Vite + Tailwind CSS v4 (frontend).

# Developer Commands
* **Frontend** (`cd frontend`): `yarn dev` (Vite; proxies `/api` and `/sub` to `localhost:55000`, so run the backend too), `yarn build` (`tsc -b && vite build`, **outputs to `backend/http/dist`**), `yarn lint`, `yarn preview`.
* **Backend** (`cd backend`; `go.mod` lives in the repo root, not in `backend/`):
    * `go run main.go` — run locally. `backend/http/dist` must exist (see "Embedded frontend"), otherwise compilation fails.
    * `go build ./...` and `go vet ./...` — the check to run after any Go change (there are no tests in the repo).
    * Windows release build: `go build -tags with_utls -ldflags "-H=windowsgui -s -w -X main.version=<x.y.z>" -o wl-download.exe main.go`
    * Linux/macOS release build: same without `-H=windowsgui`; requires `CGO_ENABLED=1` (systray) plus `libgtk-3-dev libayatana-appindicator3-dev gcc` on Linux. Windows builds use `CGO_ENABLED=0`.
    * `-tags with_utls` is required by CI for sing-box uTLS/Reality; keep it in every release build.
* **Docker:** `docker compose up --build` (multi-stage: builds frontend, then backend, mounts `./data`; uses `XDG_*` env vars to redirect config/data/logs).

# Architecture & Directory Structure
Go module: `github.com/rom5n/whitelist-download`. Entry point `backend/main.go`.

* `backend/main.go` — startup order: `logging.Initialize` → `config.Load` → `startup.Add` → build shared state (`SafeConfigsCache`, `Statistics`, `SafeUpdaterState`, GeoIP `Locator`) → `tray.Run(startApp)`. `startApp` launches the aggregator, opens the browser, starts the updater and the HTTP server, then waits on a `sync.WaitGroup`. SIGINT/SIGTERM cancel the shared `context`. `version` is injected via `-X main.version=...` and passed to the updater through `ctx.Value("version")`. Note: `main` begins with `time.Sleep(10s)` (autostart delay) — account for it when testing startup.
* `backend/aggregator` — `StartPollingConfigs` loop (re-reads config every cycle, interval = `UpdateInterval` minutes, retries in 30s on failure) and `UpdateConfigs` pipeline: `getConfigs` (fetch sources, drop duplicates ignoring the `#fragment`, only `vless://`) → `filterWorkingConfigs` (parallel, up to `maxWorkers=150`) → `formatConfigs` (GeoIP, rewrites the fragment to `<flag> <Country> — #<n>`) → `SortConfigs` (group by country) → `updateCacheAndFile` (sets cache, writes `configs.txt` atomically via `.tmp` + rename). Whole update has a 5-minute timeout.
    * Working check: `WorkingCheckLevel` 1 = TCP dial to host:port (2s); 2 = real sing-box instance with a local SOCKS inbound on ports `20000+i` (pool of `maxWorkers`), requesting `http://cp.cloudflare.com/generate_204` through it (7s). `buildSingBoxOptions` supports only VLESS with `tls`/`reality` security and `ws`/`grpc` transports — extend it there when adding transports.
* `backend/http` — `http.go` builds the `ServeMux` and server on `0.0.0.0:<cfg.Port>` (default 55000); embeds the frontend with `//go:embed dist/*`. `backend/http/handler` holds handlers (closures returned by constructors that receive shared state):
    * `subscription.go` — `<SubscriptionPath>` and `<SubscriptionPath>/...` (default `/sub`): base64 body + `profile-title`/`announce`/etc. headers. Path forms: `/sub/50` (limit), `/sub/10-30` (offset-limit), `/sub/<country>` and `/sub/<country>/10-30` (country with `-` for spaces, e.g. `united-states`). Serves from cache, falls back to the file.
    * `api_configs.go` — `GET /api/configs?country=&offset=&limit=` (offset is 1-based).
    * `api_info.go` — `/api/subscription-link`, `/api/statistics`, `/api/get-config`, `/api/set-config`.
    * `api_system.go` — `/api/update-configs` (forced update; also triggered from the tray via GET), `/api/logs`, `/api/restart`, `/api/updater/status`, `POST /api/updater/download`.
    * `web.go` — serves the SPA with fallback to `index.html`. `helpers.go` — URL param parsing and `resolveConfigsPath`.
    * Any new/changed endpoint must be reflected in `frontend/API_DOCUMENTATION.md` and `frontend/src/api.ts`.
* `backend/config` — `Config` struct (JSON tags = `config.json` keys), `Load/Save/Set`, and `RetrieveSafe(fields ...Field)`, which returns a **copy** containing only the requested fields under the read lock. New setting = add the struct field + `Field` constant + `Set` + `RetrieveSafe` case (+ default in `newDefaultConfig`, + frontend settings UI). Some settings (port, subscription path) only take effect after `/api/restart`.
* `backend/domain` — thread-safe shared types: `SafeConfigsCache` (country → configs; `Get/Set` clone the map), `Statistics` (embedded RWMutex), `SafeUpdaterState` (status: `checking|available|downloading|installing|up-to-date|error`), `SafeFile`.
* `backend/geo_ip` — `Locator` with an embedded `geoip.mmdb` (`go:embed`); resolves host via DNS, returns country name + emoji flag, or `Unknown`/`❓`.
* `backend/updater` — self-update from GitHub Releases of `rom5n/whitelist-download` (checks every 15 min). Downloads the asset named `wl-download-<GOOS>[-<GOARCH> on darwin][.exe on windows]` — this name is coupled to `.github/workflows/release.yml`; change both together. Replaces the running exe (old one renamed to `<exe>.old`, removed on next start in `setExecutableDir`) and restarts. Auto-update is gated by `AutoUpdateMajor` / `AutoUpdatePatch`; versions are compared on `major.minor[.patch]` (minor bump counts as "major").
* `backend/startup` — per-OS autostart via build-tagged files by filename suffix: `_windows` (registry `HKCU\...\Run`), `_linux` (`~/.config/autostart/*.desktop`), `_darwin` (`~/Library/LaunchAgents/*.plist`). All expose `Add(cfg)`.
* `backend/tray` — system tray (`getlantern/systray`); menu: open dashboard, force update, quit. `tray.Run` blocks the main thread. `backend/browser` — opens the dashboard in the default browser.
* `backend/paths` — `ResolveDataFile` / `MigrateLegacy`: XDG data-file resolution and one-time migration of legacy files from the exe directory. Must not import other project packages (`logging` depends on it); callers log the returned errors. Use it instead of re-implementing path logic.
* `backend/logging` — global `logging.Log` (zap JSON, debug level) writing to a size-rotated file (25 MB); `logging.LogPath` is served by `/api/logs`. The log file is **truncated on every start**.
* `frontend/src` — React app (`api.ts` API client, `components/`, `i18n.tsx`, `ThemeContext.tsx`, `countryFlags.ts`).
* `.github/workflows/release.yml` — builds 4 targets on `v*` tags and publishes a GitHub Release. `.agents/skills/` — helper skills for AI agents (Tailwind 4 docs, React best practices, frontend design).

# Runtime Files & Paths
* On start the process `chdir`s to the executable's directory (`setExecutableDir`) and deletes a leftover `<exe>.old`.
* Persistent files live in XDG directories (`github.com/adrg/xdg`; overridable with `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`): `config.json` → `<config>/whitelist-download/`, `configs.txt` (name from `ConfigsPath`) → `<data>/whitelist-download/`, `app.log` → `<state>/whitelist-download/`.
* Legacy files next to the executable are auto-migrated to the XDG locations on first run via `paths.MigrateLegacy` / `paths.ResolveDataFile`.
* `config.json` is created with defaults if missing; invalid JSON aborts startup (`os.Exit(1)`).
* `configs.txt` format: one `vless://...#<flag> <Country> — #<n>` per line. Country parsing in `SortConfigs`, `sendConfigsFromFile` and `extractConfigsFromFile` relies on the `" — "` separator — do not change the fragment format in one place only.

# Embedded frontend
`backend/http/dist` is git-ignored and produced by `yarn build`. Before `go build`/`go run` from a clean checkout run `cd frontend && yarn install && yarn build`. Never edit files in `dist` by hand.

# Coding Standards & Guidelines
* **Go:**
    * `gofmt` formatting; PascalCase exported, camelCase unexported. Package names are lowercase (existing exception: `geo_ip`); keep packages domain-driven.
    * Strong typing; avoid `interface{}`/`any`. Known legacy exception: `context.WithValue(ctx, "version", ...)` with a string key — do not copy this pattern; prefer explicit parameters or a typed key.
    * Errors: return them wrapped with context (`fmt.Errorf("...: %w", err)`); do not discard them with `_`. Existing code ignores some errors (e.g. `os.Rename`, `os.Remove`, `Write` on response) — don't add new ones; log with `logging.Log` at least. `os.Exit(1)` is used only for unrecoverable startup errors.
    * Logging: `logging.Log` (zap) with structured fields (`zap.String`, `zap.Error`, ...); never `fmt.Print*`/`log.Print*` in app code (the `log` package is used only inside `logging`).
    * Concurrency: shared state goes through `domain.Safe*`, `domain.Statistics` locks, or `Config.RetrieveSafe` — never read `Config` fields directly from other goroutines. In goroutine fan-out loops guard **all** shared writes with the mutex (e.g. `allErrors` in `filterWorkingConfigs`/`formatConfigs` is joined under `mu`).
    * Respect `ctx` cancellation in long-running loops and network calls; new background goroutines must be registered in the `WaitGroup` and stop on `ctx.Done()`.
    * Cross-platform: OS-specific code goes into `_windows.go`/`_linux.go`/`_darwin.go` files, and every OS-specific function needs an implementation for all three. Don't use Windows-only APIs in shared files.
    * Security: the server binds `0.0.0.0` and the API (`set-config`, `restart`, `updater/download`, `logs`) has **no authentication** — don't add endpoints that expose secrets or execute arbitrary commands/paths without discussing it.
* **TypeScript/React:** follow `eslint.config.js`. PascalCase components, camelCase variables/functions. No inline styles — use Tailwind CSS v4 utilities (see `.agents/skills/tailwind-4-docs`). Strict typing, no `any`; define interfaces for all API responses and component props. Handle API errors in the UI (`try/catch` / `.catch`). UI strings go through `i18n.tsx`. Call the API with relative URLs (works with the Vite proxy and the embedded build; backend port is `55000` by default).
* **Language:** code, comments and commit messages in English; end-user texts are localized (RU/EN in the frontend; tray menu is currently Russian).

# Environment & Setup
* Go 1.26.2+ (per `go.mod`), Yarn 1.22.x, Node 22 (CI). `release.yml` reads the Go version from `go.mod`; `Dockerfile` pins `golang:1.26-alpine` — bump it together with the `go` directive.
* Local server strictly on the configured port (default `55000`); the tray "force update" and browser opening use this port.
* The app modifies OS autostart entries on every start (`startup.Add`) — be careful when running it on a dev machine; it registers the current exe path.
* Sing-box (`sagernet/sing-box`) is a heavy dependency; the first `go build` is slow. `backend/test.exe` is a git-ignored local artifact — never commit binaries.

# Git Workflow
* **Commit Messages:** Conventional Commits (`feat: add new proxy source`, `fix: resolve race condition in cache`, `chore: update dependencies`).
* **Branching:** isolated feature/bugfix branches; PRs target `main`.
* **Before a PR:** `cd frontend && yarn lint && yarn build`, then `cd backend && go vet ./... && go build ./...`. If you changed platform-specific or release-related code, sanity-check with `GOOS=linux`/`darwin` where possible (`go vet` with `GOOS` set, CGO permitting).
* **Releases:** pushing a `v*` tag triggers `release.yml`; the tag (without `v`) becomes `main.version`, which the updater compares against GitHub's latest release.
