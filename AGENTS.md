# Project Overview
Whitelist-download is an automatic VLESS config aggregator and local subscription server. It gathers free VLESS configurations from GitHub repositories and serves them as a single subscription link via a local HTTP server, featuring a web dashboard for monitoring and management. The primary tech stack consists of Go (Backend) and React with TypeScript, Vite, and Tailwind CSS v4 (Frontend).
# Developer Commands
* **Frontend Setup & Run:**
    * `cd frontend`
    * `yarn dev` (Start Vite development server)
    * `yarn build` (Compile TypeScript and build production bundle)
    * `yarn lint` (Run ESLint)
    * `yarn preview` (Preview production build locally)
* **Backend Setup & Run:**
    * `cd backend`
    * `go run main.go` (Run the server locally)
    * `go build -ldflags "-H=windowsgui -s -w" -o wl-download.exe main.go` (Build the optimized, silent Windows executable)
# Architecture & Directory Structure
* `/backend`: Core Go application logic.
    * `/backend/aggregator`: Logic for polling and parsing VLESS configs from external sources.
    * `/backend/http`: Local HTTP server (runs on port 55000) for serving the dashboard and subscription links.
    * `/backend/domain`: Shared types and thread-safe data structures (`SafeConfigsCache`, `Statistics`).
    * `/backend/geo_ip`: IP geolocation resolution logic.
    * `/backend/logging`: Centralized logging configuration using Zap.
    * `/backend/startup`: Windows registry autostart configuration.
* `/frontend`: React web dashboard source code (`/src`) utilizing Vite and Tailwind CSS.
* `configs.txt`: Local file-based cache for downloaded configurations.
* `config.json`: Main application settings and preferences.
* `logs.txt`: Application runtime logs.
# Coding Standards & Guidelines
* **Code style and naming conventions:**
    * **Go:** Adhere to standard `gofmt` formatting. Use PascalCase for exported entities and camelCase for unexported ones. Keep packages domain-driven (e.g., `aggregator`, `geo_ip`).
    * **TypeScript/React:** Follow rules defined in `eslint.config.js`. Use PascalCase for React components and camelCase for variables/functions. Avoid inline styles; utilize Tailwind CSS v4 utility classes.
* **Type safety and strictness:**
    * **Go:** Rely on strong static typing. Avoid `interface{}` unless implementing generics or empty interfaces are strictly required.
    * **TypeScript:** Maintain strict typing. Do not use `any`; define explicit interfaces or types for all API responses and component props.
* **Error handling and logging practices:**
    * **Go:** Errors must be explicitly handled and returned up the call stack. Do not ignore errors using `_`. Use `go.uber.org/zap` (via `logging.Log`) for structured, leveled logging instead of standard `fmt.Print`.
    * **TypeScript:** Handle API errors gracefully in the UI. Catch promises or use `try/catch` in async functions.
* **State management or data fetching patterns:**
    * **Go Backend:** Shared state (like cached configs and statistics) must be thread-safe. Use mutexes (e.g., `domain.SafeConfigsCache`) to prevent race conditions during background polling and concurrent HTTP requests.
    * **React Frontend:** Data fetching should target the local API (`http://localhost:55000/`).
# Environment & Setup
* **Dependencies:** Requires Go version 1.26.2+ and Yarn version 1.22.22+.
* **Runtime Behavior:** The backend automatically changes its working directory to the executable's location to correctly resolve `config.json`, `configs.txt`, and `logs.txt`.
* **Local Infrastructure:** The application binds a local HTTP server strictly to port `55000`.
* **Windows Specifics:** When built for Windows, the `-H=windowsgui` flag suppresses the console window for background execution. The application may modify the Windows registry to ensure autostart (`startup` package).
# Git Workflow
* **Commit Messages:** Use Conventional Commits formatting (e.g., `feat: add new proxy source`, `fix: resolve race condition in cache`, `chore: update dependencies`).
* **Branching:** Work on isolated feature or bugfix branches. Test both the frontend build and backend binary compilation locally before opening pull requests to the `main` branch.