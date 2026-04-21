/**
 * User-facing error messages returned to the calling AI agent when the bridge
 * cannot reach Dovilo Desktop. These are surfaced in the agent's chat UI via
 * stderr + non-zero exit, so they should be short, polite, and actionable.
 */

export const DESKTOP_CLOSED_MESSAGE =
  'Start Dovilo Desktop to use this AI. The desktop app must be running for AI agents to pick up queued tasks.';

export const MISSING_API_KEY_MESSAGE =
  'DOVILO_API_KEY environment variable is not set. Add it to the AI agent configuration (see https://github.com/slhddn/dovilo-mcp#configuration).';

export const UNAUTHORIZED_KEY_MESSAGE =
  'DOVILO_API_KEY is invalid or has been revoked. Generate a new key from Dovilo Desktop → Settings → AI, and update your AI agent configuration.';

export const EXIT_CODE_DESKTOP_CLOSED = 2;
export const EXIT_CODE_MISSING_KEY = 3;
export const EXIT_CODE_UNAUTHORIZED = 4;
export const EXIT_CODE_UNEXPECTED = 1;
