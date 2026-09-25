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
    - [GET /api/restart-status](#get-apirestart-status)
    - [POST /api/update-configs](#post-apiupdate-configs)
    - [GET /api/logs](#get-apilogs)
    - [POST /api/restart](#post-apirestart)
2. [Subscription Endpoints](#subscription-endpoints)
    - [GET /<sub_path>](#get-sub_path)

---

## Frontend API Endpoints

### GET `/api/configs`
Retrieves a list of available VLESS proxy configurations in JSON format. This is the primary endpoint for populating the frontend dashboard.

**Query Parameters:**
- `country` (string, optional) — Filter configurations by country: the exact name (e.g., `United States`, `Bosnia and Herzegovina`) or its slug (`united-states`). If omitted, returns configs from all countries.
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
  "amount_configs": 1500,
  "configs_by_country": {
    "United States": 500,
    "Russia": 300,
    "Germany": 700
  },
  "country_codes": {
    "United States": "US",
    "Russia": "RU",
    "Germany": "DE"
  },
  "last_update": 1713000000,
  "up_at": 1712990000,
  "update_interval": 15,
  "version": "1.5.3"
}
```
*(Note: `last_update` and `up_at` are Unix timestamps in seconds; `last_update` is `0` until the first update finishes. `country_codes` maps country names to ISO 3166-1 alpha-2 codes.)*

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
  "update_interval_minutes": 15,
  "sources": [
    "https://raw.githubusercontent.com/zieng2/wl/main/vless_lite.txt",
    "..."
  ],
  "forced_ip": "",
  "working_check_level": 1,
  "auto_update_major": false,
  "auto_update_patch": true,
  "auto_browser_open": true,
  "auto_start": true
}
```
*(`auto_start` is managed from the tray menu. The configs cache always lives in `configs.txt` inside the app data directory; the former `configs_path` setting was removed and is migrated automatically.)*

### POST `/api/set-config`
Updates the application configuration.

**Request Body (JSON):**
A JSON object representing the configuration structure with the fields to update. Must follow the exact same schema as `/api/get-config`:
```json
{
  "app_name": "WhitelistsDownload",
  "subscription_title": "🌊 OpenSource VPN",
  "description_text": "⚡ Subscriptions from open sources",
  "port": "55000",
  "subscription_path": "/sub",
  "update_interval_minutes": 15,
  "sources": [
    "https://raw.githubusercontent.com/zieng2/wl/main/vless_lite.txt"
  ],
  "forced_ip": "",
  "working_check_level": 1
}
```

Validation: `update_interval_minutes` must be between `5` and `1440`, `port` between `1` and `65535`, `working_check_level` is `1` or `2`. `auto_start` is ignored.

**Response:**
- `200 OK` with the same body as [`/api/restart-status`](#get-apirestart-status).
- `400 Bad Request` if the body is malformed or fails validation (the text explains why).
- `500 Internal Server Error` if the config can't be saved.

### GET `/api/restart-status`
Reports saved settings that only take effect after a restart (`port`, `subscription_path`, `app_name`).

**Response (JSON):**
```json
{
  "restart_required": true,
  "fields": ["port"]
}
```

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
