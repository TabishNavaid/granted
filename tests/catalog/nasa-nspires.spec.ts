import { expect, test } from "@playwright/test";
import { connectors, nasaNspires } from "@/lib/catalog/connectors/nasa-nspires";
import { fixtureFetch, runOffline } from "./helpers";

test.describe("NASA NSPIRES", () => {
  test("is off and says why", () => {
    expect(connectors).toEqual([nasaNspires]);
    expect(nasaNspires.source.enabled).toBe(false);
    expect(nasaNspires.source.notes).toMatch(/Grants\.gov/);
  });

  test("a run makes no requests and writes nothing", async () => {
    const f = fixtureFetch("nasa_nspires", []);
    const { sink, result } = await runOffline(nasaNspires, f);
    expect(result.status).toBe("succeeded");
    expect(f.calls).toHaveLength(0);
    expect(sink.opportunityRows).toHaveLength(0);
  });
});
