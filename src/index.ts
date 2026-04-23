#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { forwardMessage, preFilterStdioLine, probeDesktopPort } from './bridge.js';
import {
  DESKTOP_CLOSED_MESSAGE,
  EXIT_CODE_DESKTOP_CLOSED,
  EXIT_CODE_MISSING_KEY,
  EXIT_CODE_UNAUTHORIZED,
  EXIT_CODE_UNEXPECTED,
  MISSING_API_KEY_MESSAGE,
  UNAUTHORIZED_KEY_MESSAGE,
} from './errors.js';

/**
 * @dovilo-app/mcp — MCP stdio bridge for Dovilo Desktop.
 *
 * The AI agent (Claude Code / Cursor / Claude Desktop / etc.) launches this
 * binary via `npx -y @dovilo-app/mcp@latest` with a `DOVILO_API_KEY` env var. Each
 * stdin line is forwarded to the desktop's local HTTP MCP server and the
 * response is written back to stdout. Nothing sensitive is handled here.
 */

function fatal(message: string, exitCode: number): never {
  process.stderr.write(`[@dovilo-app/mcp] ${message}\n`);
  process.exit(exitCode);
}

async function main(): Promise<void> {
  const apiKey = process.env.DOVILO_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    fatal(MISSING_API_KEY_MESSAGE, EXIT_CODE_MISSING_KEY);
  }

  const host = process.env.DOVILO_HOST ?? '127.0.0.1';
  const envPort = process.env.DOVILO_PORT ? Number(process.env.DOVILO_PORT) : NaN;
  let port: number;
  if (Number.isFinite(envPort) && envPort > 0 && envPort < 65_536) {
    port = envPort;
  } else {
    const probed = await probeDesktopPort(host);
    if (probed === null) {
      fatal(DESKTOP_CLOSED_MESSAGE, EXIT_CODE_DESKTOP_CLOSED);
    }
    port = probed;
  }

  const config = { apiKey, host, port };

  const rl = createInterface({ input: process.stdin, terminal: false });

  for await (const rawLine of rl) {
    const line = preFilterStdioLine(rawLine);
    if (!line) continue;

    try {
      const response = await forwardMessage(config, line);
      // Notifications return null — MUST NOT emit a stdout line (JSON-RPC 2.0).
      if (response === null) continue;
      // MCP stdio framing: newline-delimited JSON (single line per message).
      process.stdout.write(response.trim() + '\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === UNAUTHORIZED_KEY_MESSAGE) {
        fatal(UNAUTHORIZED_KEY_MESSAGE, EXIT_CODE_UNAUTHORIZED);
      }
      // Soft errors are returned to the agent as a JSON-RPC error so the tool
      // call fails gracefully — unless the original message was a notification
      // (no id), in which case we log to stderr and stay silent on stdout.
      try {
        const parsed = JSON.parse(line) as { id?: string | number | null; method?: string };
        const isNotification =
          parsed?.id === undefined ||
          (typeof parsed?.method === 'string' && parsed.method.startsWith('notifications/'));
        if (isNotification) {
          process.stderr.write(`[@dovilo-app/mcp] notification error (suppressed): ${message}\n`);
        } else {
          const envelope = {
            jsonrpc: '2.0',
            id: parsed?.id ?? null,
            error: {
              code: -32000,
              message,
              data: { domainCode: 'BRIDGE_ERROR' },
            },
          };
          process.stdout.write(JSON.stringify(envelope) + '\n');
        }
      } catch {
        process.stderr.write(`[@dovilo-app/mcp] ${message}\n`);
      }
    }
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  fatal(message, EXIT_CODE_UNEXPECTED);
});
