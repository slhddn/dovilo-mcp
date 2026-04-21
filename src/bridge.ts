import { request as httpRequest } from 'node:http';
import { UNAUTHORIZED_KEY_MESSAGE } from './errors.js';

/**
 * Thin stdio↔HTTP bridge between an AI agent (Claude Code / Cursor / etc.) and
 * Dovilo Desktop's local MCP server (127.0.0.1:17892).
 *
 * Every JSON-RPC message received on stdin is POSTed to /mcp with a Bearer
 * Authorization header; the HTTP response is written back to stdout with a
 * newline framing. No MCP-layer logic lives here — Dovilo Desktop's router
 * handles `initialize`, `tools/list`, and `tools/call`.
 */

const DEFAULT_PORT = 17892;
const PORT_PROBE_RANGE = 10;
const REQUEST_TIMEOUT_MS = 60_000;

export type BridgeConfig = {
  apiKey: string;
  host?: string; // default 127.0.0.1
  port?: number; // default: probe 17892..17901
};

export async function probeDesktopPort(host: string = '127.0.0.1'): Promise<number | null> {
  for (let i = 0; i < PORT_PROBE_RANGE; i++) {
    const port = DEFAULT_PORT + i;
    const ok = await new Promise<boolean>((resolve) => {
      const req = httpRequest(
        {
          host,
          port,
          path: '/health',
          method: 'GET',
          timeout: 1_000,
        },
        (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
    if (ok) return port;
  }
  return null;
}

export async function forwardMessage(
  config: Required<BridgeConfig>,
  body: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: config.host,
        port: config.port,
        path: '/mcp',
        method: 'POST',
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode === 401) {
            reject(new Error(UNAUTHORIZED_KEY_MESSAGE));
            return;
          }
          if ((res.statusCode ?? 500) >= 500) {
            reject(new Error(`Dovilo Desktop returned HTTP ${res.statusCode}: ${data}`));
            return;
          }
          resolve(data);
        });
      },
    );
    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.write(body);
    req.end();
  });
}

/**
 * Strip messages that must NEVER be forwarded (e.g. large inline binary data).
 * v1: pass-through (desktop enforces 256 KB body limit).
 */
export function preFilterStdioLine(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}
