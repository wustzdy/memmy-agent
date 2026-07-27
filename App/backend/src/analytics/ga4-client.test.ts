import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveGa4Config, sendGa4Events } from "./ga4-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GA4 desktop analytics proxy client", () => {
  it("sends desktop events to the cloud analytics proxy without GA4 secrets", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ code: 0, data: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchImpl);

    await sendGa4Events({
      config: {
        cloudServiceBaseUrl: "https://cloud.example.com/",
        timeoutMs: 1000
      },
      clientId: "123.456",
      appEnv: "prod",
      events: [{ name: "app_exit", params: { source: "quit" } }]
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://cloud.example.com/api/analytics/desktop/events");
    expect((init as RequestInit).headers).toMatchObject({ "content-type": "application/json" });
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      clientId: "123.456",
      appEnv: "prod",
      events: [
        {
          eventName: "app_exit",
          params: {
            source: "quit",
            engagement_time_msec: 100
          }
        }
      ]
    });
  });

  it("resolves analytics proxy config from MEMMY_CLOUD_SERVICE only", () => {
    const config = resolveGa4Config({
      MEMMY_CLOUD_SERVICE: " https://cloud.example.com ",
      MEMMY_GA4_MEASUREMENT_ID: "G-TEST",
      MEMMY_GA4_API_SECRET: "secret"
    } as NodeJS.ProcessEnv);

    expect(config).toEqual({
      cloudServiceBaseUrl: "https://cloud.example.com",
      timeoutMs: 5000
    });
  });
});
