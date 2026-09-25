# Whitelist Download API Documentation

This document describes the HTTP API endpoints provided by the backend server. 
The server typically runs locally on port `55000`. Base URL for API calls is usually: `http://localhost:55000` or `http://<server-ip>:55000`.

## Table of Contents
1. [Frontend API Endpoints](#frontend-api-endpoints)
    - [GET /api/configs](#get-apiconfigs)
    - [GET /api/statistics](#get-apistatistics)
    - [GET /api/subscription-link](#get-apisubscription-link)
    - [GET /api/get-config](#get-apiget-config)
    - [POST /api/set-config](#post-apiset-config)
    - [POST /api/update-configs](#post-apiupdate-configs)
    - [GET /api/logs](#get-apilogs)
    - [POST /api/restart](#post-apirestart)
    - [GET /api/restart-required](#get-apirestart-required)
    - [GET /api/polling](#get-apipolling)
    - [POST /api/polling/pause](#post-apipollingpause)
    - [POST /api/polling/resume](#post-apipollingresume)
    - [POST /api/polling/check-level](#post-apipollingcheck-level)
2. [Subscription Endpoints](#subscription-endpoints)
    - [GET /<sub_path>](#get-sub_path)

---

## Frontend API Endpoints

### GET `/api/configs`
Retrieves a list of available VLESS proxy configurations in JSON format. This is the primary endpoint for populating the frontend dashboard.

**Query Parameters:**
- `country` (string, optional) — Filter configurations by country name (e.g., `United States`, `Russia`). If omitted, returns configs from all countries.
- `offset` (integer, optional) — Pagination offset (1-indexed). Default is `1`.
- `limit` (integer, optional) — Maximum number of configs to return. If `0` or omitted, returns all available configs.

**Response (JSON):**
```json
{
  "configs": [
    "vless://uuid@ip:port?type=tcp#🇺🇸 United States — #1",
    "vless://uuid@ip:port?type=tcp#🇺🇸 United States — #2"
  ]
}
```

### GET `/api/statistics`
Retrieves current statistics about the aggregated configurations.

**Response (JSON):**
```json
{
  "LastUpdate": 1713000000,
  "AmountConfigs": 1500,
  "ConfigsByCountry": {
    "United States": 500,
    "Russia": 300,
    "Germany": 700
  }
}
```
*(Note: `LastUpdate` is a Unix timestamp in seconds).*

### GET `/api/subscription-link`
Retrieves the full URL to the subscription endpoint (e.g., for "Copy Link" buttons in the UI).

**Response (text/plain):**
```text
http://192.168.1.100:55000/sub
```

### GET `/api/get-config`
Retrieves the current application configuration.

**Response (JSON):**
Returns the serialized configuration object containing the application settings.
```json
{
  "app_name": "WhitelistsDownload",
  "subscription_title": "🌊 OpenSource VPN",
  "description_text": "⚡ Subscriptions from open sources",
  "port": "55000",
  "subscription_path": "/sub",
  "update_interval_minutes": 60,
  "sources": [
    "https://raw.githubusercontent.com/zieng2/wl/main/vless_lite.txt",
    "..."
  ],
  "forced_ip": "",
  "working_check_level": 1,
  "paused_until": 0,
  "auto_start": true,
  "notifications": true,
  "language": "auto"
}
```
The configs file is always `configs.txt` in the app data directory: the former `configs_path` setting was removed (a file with a custom name is renamed on start, the key is dropped from `config.json` on the next save and ignored if sent).

Some fields are managed from the system tray and are read-only here: `POST /api/set-config` ignores them, so a stale settings form can't change them.
- `paused_until` — the configs auto update pause (`0` - active, `-1` - paused until resumed, otherwise the Unix time of resuming). It can also be changed with the [`/api/polling/*`](#get-apipolling) endpoints.
- `auto_start` — start the app with the system.
- `notifications` — show desktop notifications about updates.
- `language` — system tray language: `auto` (follow the system), `ru` or `en`.

### POST `/api/set-config`
Updates the application configuration. The dashboard calls it on every change of a setting (text fields after a pause in typing), so it validates the values and rejects the ones the server could not start with.

**Request Body (JSON):**
A JSON object representing the configuration structure with the fields to update. Must follow the exact same schema as `/api/get-config`:
```json
{
  "app_name": "WhitelistsDownload",
  "subscription_title": "🌊 OpenSource VPN",
  "description_text": "⚡ Subscriptions from open sources",
  "port": "55000",
  "subscription_path": "/sub",
  "update_interval_minutes": 60,
  "sources": [
    "https://raw.githubusercontent.com/zieng2/wl/main/vless_lite.txt"
  ],
  "forced_ip": "",
  "working_check_level": 1
}
```

**Validation:**
- `app_name` — not empty, no slashes.
- `port` — a number from `1` to `65535`.
- `subscription_path` — starts with `/`, no trailing slash, only letters, digits and `. _ ~ -`; the first segment can't be `api` or `assets`.
- `update_interval_minutes` — from `1` to `10080` (one week).
- `working_check_level` — `1` or `2`.
- `forced_ip` — no spaces or slashes.
- `sources` — absolute `http(s)` URLs.

**Response:**
- `200 OK` with the [restart state](#get-apirestart-required) (JSON) on success.
- `400 Bad Request` if the body is invalid or a value fails validation; the body explains which field is wrong, e.g. `invalid config: port must be a number from 1 to 65535`. Nothing is saved.
- `405 Method Not Allowed` for methods other than `POST`.
- `500 Internal Server Error` if the config could not be saved.

### POST `/api/update-configs`
Forces an immediate update and re-aggregation of configurations from external sources.

**Response (text/plain):**
- `200 OK` on success.

### GET `/api/logs`
Streams or returns the contents of the application's runtime log file (`logs.txt`).

**Response (text/plain):**
Raw log output.

### POST `/api/restart`
Initiates a graceful restart of the backend application (useful after updating configurations that require a restart).

**Response:**
Closes the connection as the server restarts.

### GET `/api/restart-required`
Returns the settings that were changed after the server started and only take effect after a restart (`app_name`, `port`, `subscription_path`). Changing a value back cancels it, and the state is reset by a restart. The dashboard uses it to highlight the restart button.

**Response (JSON):**
```json
{ "required": true, "fields": ["port"] }
```

### GET `/api/polling`
Returns the state of the configs auto update: whether it is paused and which working check level is used. The system tray and the dashboard share this state, so a change made in one is visible in the other.

**Response (JSON):**
```json
{
  "paused": true,
  "forever": false,
  "paused_until": 1790350670,
  "working_check_level": 1
}
```
- `paused` — auto update is paused. A manual update (`/api/update-configs`) still works while paused.
- `forever` — paused until resumed manually.
- `paused_until` — Unix time (seconds) when the auto update resumes; `0` if not paused or `forever` is `true`.
- `working_check_level` — `1` - ping test, `2` - sing-box core test.

The pause is stored in `config.json`, so it survives restarts. An expired pause is treated as not paused.

### POST `/api/polling/pause`
Pauses the configs auto update for a while or until resumed.

**Request Body (JSON):**
```json
{ "minutes": 60 }
```
or
```json
{ "forever": true }
```
- `minutes` — pause duration in minutes, from `1` to `525600` (one year).
- `forever` — pause until `/api/polling/resume` is called; takes precedence over `minutes`.

**Response:**
- `200 OK` with the updated state (same JSON as `GET /api/polling`).
- `400 Bad Request` if the body is invalid or the duration is out of range.
- `405 Method Not Allowed` for methods other than `POST`.
- `500 Internal Server Error` if the config could not be saved.

### POST `/api/polling/resume`
Cancels the pause. If updates were paused, an update starts right away.

**Response:**
- `200 OK` with the updated state (same JSON as `GET /api/polling`).
- `500 Internal Server Error` if the config could not be saved.

### POST `/api/polling/check-level`
Changes the working check level. It is saved to `config.json` and applies from the next update.

**Request Body (JSON):**
```json
{ "level": 2 }
```
- `level` — `1` for the ping test (fast), `2` for the sing-box core test (slower, more accurate).

**Response:**
- `200 OK` with the updated state (same JSON as `GET /api/polling`).
- `400 Bad Request` if the body is invalid or the level is not `1` or `2`.
- `500 Internal Server Error` if the config could not be saved.

---

## Subscription Endpoints

### GET `/<sub_path>`
*Note: The path is defined by `SubscriptionPath` in the config, default is typically `/sub`.*

Provides Base64 encoded proxy configurations for V2Ray/Xray clients. It injects custom HTTP headers (`profile-update-interval`, `profile-title`, etc.) for seamless client integration.

**Path Parameters:**
This endpoint supports a dynamic URL path structure to act as filter parameters:
- `/<sub_path>` — Returns all configs.
- `/<sub_path>/<limit>` — Returns a limited amount of configs.
- `/<sub_path>/<offset>-<limit>` — Pagination without country filter.
- `/<sub_path>/<country>` — Returns configs only for a specific country (e.g., `/sub/united-states`). Country names with spaces are formatted with hyphens.
- `/<sub_path>/<country>/<limit>` — Country + limit.
- `/<sub_path>/<country>/<offset>-<limit>` — Country + pagination.

**Response (text/plain, Base64):**
Returns Base64 encoded VLESS links, separated by newlines.
