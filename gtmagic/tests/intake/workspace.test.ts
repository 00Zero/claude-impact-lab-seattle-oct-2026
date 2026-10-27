import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { isSafeName, listBusinesses, readBusiness } from "@/app/_intake/workspace";

const demo = readFileSync("fixtures/demo/intake.json", "utf8");
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gtm-"));
  process.env.GTM_ROOT = root;
  mkdirSync(join(root, "gtm-workspace", "acme"), { recursive: true });
  writeFileSync(join(root, "gtm-workspace", "acme", "intake.json"), demo);
  mkdirSync(join(root, "gtm-workspace", "empty-folder"), { recursive: true });
  mkdirSync(join(root, "gtm-workspace", ".sessions", "abcd1234"), { recursive: true });
});

describe("listBusinesses", () => {
  it("lists the demo first, then saved businesses, skipping folders without a save file and .sessions", async () => {
    const list = await listBusinesses();
    expect(list.map((b) => b.slug)).toEqual(["demo", "acme"]);
    expect(list[0]?.isDemo).toBe(true);
    expect(list[1]?.status).toBe("ready");
  });
});

describe("isSafeName", () => {
  it("rejects traversal and odd characters", () => {
    expect(isSafeName("../x", "business")).toBe(false);
    expect(isSafeName("Acme", "business")).toBe(false);
    expect(isSafeName("acme-co", "business")).toBe(true);
    expect(isSafeName("abcd1234", "session")).toBe(true);
    expect(isSafeName("ab", "session")).toBe(false);
  });
});

describe("readBusiness", () => {
  it("returns null for unsafe or unknown names", async () => {
    expect(await readBusiness("../etc")).toBeNull();
    expect(await readBusiness("nope")).toBeNull();
  });

  it("reads the demo from fixtures", async () => {
    const r = await readBusiness("demo");
    expect(r && "brief" in r ? r.brief.business.name : null).toBe("KeepStrong (fictional)");
  });

  it("keeps the last good version while the file is half-written", async () => {
    const first = await readBusiness("acme");
    expect(first && "brief" in first).toBe(true);
    writeFileSync(join(root, "gtm-workspace", "acme", "intake.json"), demo.slice(0, 200));
    const second = await readBusiness("acme");
    expect(second && "brief" in second ? second.brief.business.name : null).toBe("KeepStrong (fictional)");
  });

  it("reports an unreadable file it has never read successfully", async () => {
    mkdirSync(join(root, "gtm-workspace", "broken"), { recursive: true });
    writeFileSync(join(root, "gtm-workspace", "broken", "intake.json"), "{ nope");
    const r = await readBusiness("broken");
    expect(r && "error" in r).toBe(true);
  });
});
