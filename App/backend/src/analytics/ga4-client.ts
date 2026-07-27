/** Ga4 client module. */
import { resolveCloudServiceBaseUrl } from "@memmy/local-api-contracts";

const DESKTOP_ANALYTICS_PROXY_PATH = "/api/analytics/desktop/events";

export interface Ga4Config {
  /** Cloud service base URL that proxies desktop analytics to GA4. */
  cloudServiceBaseUrl: string;
  /** Timeout ms. */
  timeoutMs: number;
}

export interface Ga4Event {
  name: string;
  params?: Record<string, string | number | boolean>;
  eventTimeMillis?: number;
}

export interface SendGa4EventsOptions {
  config: Ga4Config;
  /** Client id. */
  clientId: string;
  events: Ga4Event[];
  appEnv?: "dev" | "prod";
}

export async function sendGa4Events(opts: SendGa4EventsOptions): Promise<void> {
  const { config, clientId, events, appEnv } = opts;
  const url = `${normalizeBaseUrl(config.cloudServiceBaseUrl)}${DESKTOP_ANALYTICS_PROXY_PATH}`;

  const enrichedEvents = events.map((event, index) => ({
    eventName: event.name,
    params: {
      ...event.params,
      engagement_time_msec: index === 0 ? 100 : 1
    },
    ...(event.eventTimeMillis === undefined ? {} : { eventTimeMillis: event.eventTimeMillis })
  }));

  const payload = {
    clientId,
    ...(appEnv ? { appEnv } : {}),
    events: enrichedEvents
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "connection": "close" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.timeoutMs)
  });
  const envelope = await readCloudEnvelope(response);

  if (!response.ok || envelope.code !== 0) {
    throw new Error(envelope.message || `Analytics proxy request failed with HTTP ${response.status}`);
  }
}

export function resolveGa4Config(env: NodeJS.ProcessEnv = process.env): Ga4Config | undefined {
  try {
    return {
      cloudServiceBaseUrl: resolveCloudServiceBaseUrl(env.MEMMY_CLOUD_SERVICE),
      timeoutMs: Number.parseInt(env.MEMMY_GA4_TIMEOUT_MS ?? env.MEMMY_CLOUD_TIMEOUT_MS ?? "5000", 10)
    };
  } catch {
    return undefined;
  }
}

interface CloudEnvelope {
  code: number;
  message?: string;
}

async function readCloudEnvelope(response: Response): Promise<CloudEnvelope> {
  try {
    const value = await response.json() as Partial<CloudEnvelope>;
    return {
      code: typeof value.code === "number" ? value.code : response.ok ? 0 : response.status,
      message: typeof value.message === "string" ? value.message : undefined
    };
  } catch {
    return {
      code: response.ok ? 0 : response.status,
      message: response.ok ? "ok" : `Analytics proxy request failed with HTTP ${response.status}`
    };
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}
