# @dovilo-app/mcp

Model Context Protocol (MCP) bridge for [Dovilo Desktop](https://dovilo.app).

Connect **Cursor**, **Claude Code**, **Claude Desktop**, **Windsurf**, **Codex CLI**, **Gemini CLI**, or any other MCP-compatible AI agent to the tasks you queue from the Dovilo desktop app. The agent picks up a task, runs it step-by-step, and reports progress back to Dovilo — which shows you toasts and updates the task status in real time.

## How it works

This package is a **thin stdio↔HTTP proxy** (~100 lines). It:

1. Reads your `DOVILO_API_KEY` from the environment.
2. Locates the local Dovilo Desktop MCP server at `127.0.0.1:17892` (with port fallback).
3. Forwards MCP messages from the agent's stdio to the desktop over loopback HTTP.
4. Forwards responses back.

All real logic — authentication, rate limiting, tool dispatch, Firestore access — lives inside the Dovilo desktop app. This package holds **no secrets** and runs **no business logic**.

**Dovilo Desktop must be running** for this bridge to work. If it isn't, you'll see:

> `Start Dovilo Desktop to use this AI.`

## Installation

You don't need to install it — AI agents invoke it via `npx`. See below for how to wire it up in each agent.

## Getting an API key

1. Open Dovilo Desktop → **Settings → AI**
2. Click **Connect AI → Choose your IDE**
3. Copy the generated API key (shown once — save it immediately)
4. Paste the key into your AI agent's config using the snippets below

If you lose the key, click **Rotate key** in Dovilo Desktop to issue a new one.

## Configuration

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "dovilo": {
      "command": "npx",
      "args": ["-y", "@dovilo-app/mcp@latest"],
      "env": { "DOVILO_API_KEY": "<API_KEY>" }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add dovilo \
  --env DOVILO_API_KEY=<API_KEY> \
  -- npx -y @dovilo-app/mcp@latest
```

### Claude Desktop

Edit:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dovilo": {
      "command": "npx",
      "args": ["-y", "@dovilo-app/mcp@latest"],
      "env": { "DOVILO_API_KEY": "<API_KEY>" }
    }
  }
}
```

### Cursor CLI

```bash
cursor-cli mcp add dovilo \
  --env DOVILO_API_KEY=<API_KEY> \
  -- npx -y @dovilo-app/mcp@latest
```

### Codex CLI

```bash
codex mcp add dovilo \
  --env DOVILO_API_KEY=<API_KEY> \
  -- npx -y @dovilo-app/mcp@latest
```

### Gemini CLI

```bash
gemini mcp add dovilo \
  -e DOVILO_API_KEY=<API_KEY> \
  -- npx -y @dovilo-app/mcp@latest
```

### Windsurf

Settings → MCP Servers:

```json
{
  "name": "dovilo",
  "command": "npx",
  "args": ["-y", "@dovilo-app/mcp@latest"],
  "env": { "DOVILO_API_KEY": "<API_KEY>" }
}
```

### Custom (any MCP client)

```
npx -y @dovilo-app/mcp@latest
```

With `DOVILO_API_KEY` in the environment.

## Environment variables

| Name | Required | Default | Description |
|---|---|---|---|
| `DOVILO_API_KEY` | yes | — | Bearer token issued by Dovilo Desktop |
| `DOVILO_HOST` | no | `127.0.0.1` | Override host (testing only; must be loopback) |
| `DOVILO_PORT` | no | *probe* | Skip port discovery and use this port |

## Tools exposed

Dovilo's MCP server reports these tools to the agent:

- `agentTasks.list` — list queued/running tasks assigned to this AI
- `agentTasks.get` — fetch a single task
- `agentTasks.updateStatus` — update a task's status, optionally with a 200-char note
- `agentTasks.updateStep` — update a step's status, optionally with a 200-char note
- `agentTasks.addStep` — insert a new step
- `agentTasks.skipStep` — skip a step (only when `skippable: true`)
- `agentTasks.appendNote` — append markdown to the task's agent notes
- `agentTasks.readContext` — read task context (user's instructions + attachments)
- `agentTasks.suggestSteps` — *(v1.1, currently disabled)*

Tools that attempt to write user-owned fields (`text`, `description`, `priority`, etc.) or create/delete tasks are rejected server-side with typed `FORBIDDEN_FIELD` or `FORBIDDEN_OPERATION` errors.

## Security

- Dovilo Desktop binds **only to `127.0.0.1`** (loopback). Remote attackers cannot reach it.
- Every request must include a valid Bearer token. Tokens are stored encrypted in the OS keychain (Keychain on macOS, DPAPI on Windows, Secret Service on Linux).
- `Host` and `Origin` headers are validated to block DNS rebinding attacks.
- Tokens are never written to Firestore or sent anywhere except Dovilo Desktop.
- This package contains **no secrets**, **no telemetry**, and no Firebase/network calls outside localhost.

## License

MIT — see [LICENSE](./LICENSE).

## Support

- Issues: https://github.com/slhddn/dovilo-mcp/issues
- Website: https://dovilo.app
