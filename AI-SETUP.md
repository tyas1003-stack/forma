# Forma AI Worker

This Cloudflare Worker is the private server-side bridge to Anthropic. It never sends an API key to the browser and returns `Cache-Control: no-store` so photo-analysis responses are not cached.

## Deploy without exposing credentials

1. In the Cloudflare dashboard, import this repository as a Worker. Use the repository root and its wrangler.toml configuration.
2. Add Worker secret `ANTHROPIC_API_KEY` in **Settings → Variables and Secrets**. Paste it directly in Cloudflare; never commit it or share it in chat.
3. Optional: set `CLAUDE_MODEL` as a secret/variable after checking the current model ID in Anthropic's documentation.
4. Keep `ALLOWED_ORIGIN` set to `https://tyas1003-stack.github.io`.
5. Copy the Worker URL (for example `https://forma-ai-proxy.<account>.workers.dev`) into the frontend's public configuration only after deployment.

The public website does not ask visitors for a token. The Worker keeps the Anthropic key server-side and limits each hashed network address to five valid analysis requests per ten minutes. This is basic abuse protection, not a billing guarantee; monitor Anthropic usage and Cloudflare logs.

The public frontend should call only the Worker URL. Browser uploads are sent to Anthropic only when the user explicitly asks for AI analysis; the existing local simulation remains local.
