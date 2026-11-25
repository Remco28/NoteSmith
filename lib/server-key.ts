import type { NextRequest } from "next/server";
import type { Provider } from "@/types/notesmith";

/**
 * The server's own keys are used only for requests to localhost, or for any
 * request when NOTESMITH_SHARE_SERVER_KEY=true. A public deployment without
 * that flag never spends the host's credits on strangers.
 */
function isLocal(request: NextRequest): boolean {
  const host = request.nextUrl.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

export function serverKeyFor(request: NextRequest, provider: Provider): string | undefined {
  const shared = process.env.NOTESMITH_SHARE_SERVER_KEY === "true" || isLocal(request);
  if (!shared) return undefined;
  const key = provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  return key?.trim() || undefined;
}
