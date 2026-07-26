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
  "configs_path": "configs.txt",
  "subscription_path": "/sub",
  "update_interval_minutes": 60,
  "sources": [
    "https://raw.githubusercontent.com/zieng2/wl/main/vless_lite.txt",
    "..."
  ],
  "forced_ip": "",
  "working_check_level": 1
}
```

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
  "configs_path": "configs.txt",
  "subscription_path": "/sub",
  "update_interval_minutes": 60,
  "sources": [
    "https://raw.githubusercontent.com/zieng2/wl/main/vless_lite.txt"
  ],
  "forced_ip": "",
  "working_check_level": 1
}
```

**Response:**
- `200 OK` on success.
- `500 Internal Server Error` on failure.

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
