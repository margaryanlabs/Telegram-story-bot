# VETO Relay Mesh

VETO Relay is a Telegram-only connectivity layer for the existing VETO Telegram Mini App. It does **not** route the whole phone through VETO and it does not claim a proxy is connected until Telegram accepts it.

## Runtime configuration

Preferred: configure `VETO_RELAY_NODES` as JSON in the production environment.

```json
[
  {
    "id": "eu-1",
    "label": "EU Relay 1",
    "region": "DE",
    "host": "relay1.example.com",
    "port": 443,
    "secret": "<MTProxy secret>",
    "priority": 70
  },
  {
    "id": "eu-2",
    "label": "EU Relay 2",
    "region": "FI",
    "host": "relay2.example.com",
    "port": 443,
    "secret": "<MTProxy secret>",
    "priority": 60
  }
]
```

Single-node fallback variables are also supported:

- `VETO_RELAY_HOST`
- `VETO_RELAY_PORT` (default 443)
- `VETO_RELAY_SECRET`
- `VETO_RELAY_ID`
- `VETO_RELAY_LABEL`
- `VETO_RELAY_REGION`
- `VETO_RELAY_PRIORITY`

## Selection model

On Connect/Rotate the API performs short TCP reachability probes from the VETO backend and ranks nodes by:

1. reachable before unreachable;
2. latency;
3. configured priority.

This is a server-side health signal, not a guarantee that a specific ISP can reach the same node. The Telegram client remains the source of truth for whether the proxy was actually enabled.

## Security

- Relay API requires valid Telegram Mini App init data.
- Responses are `no-store`.
- Relay secrets stay in server environment variables and are returned only to the authenticated Mini App when a route is selected, because Telegram itself needs the MTProxy secret to connect.
- No user message content is sent through the Relay API.
