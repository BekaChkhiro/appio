import { describe, expect, it } from "vitest";
import { extractAppId, isMutableAsset, normalizePath } from "../src/routing";

const APEX = "appiousercontent.com";

describe("extractAppId", () => {
  it("accepts a single label subdomain", () => {
    expect(extractAppId("my-app.appiousercontent.com", APEX)).toBe("my-app");
  });

  it("is case-insensitive on host", () => {
    expect(extractAppId("MyApp.AppioUserContent.com", APEX)).toBe("myapp");
  });

  it("rejects the apex itself", () => {
    expect(extractAppId("appiousercontent.com", APEX)).toBeNull();
  });

  it("rejects multi-level subdomains", () => {
    expect(extractAppId("a.b.appiousercontent.com", APEX)).toBeNull();
  });

  it("rejects unrelated hosts", () => {
    expect(extractAppId("evil.com", APEX)).toBeNull();
    expect(extractAppId("appiousercontent.com.evil.com", APEX)).toBeNull();
  });

  it("rejects labels starting or ending with hyphen", () => {
    expect(extractAppId("-bad.appiousercontent.com", APEX)).toBeNull();
    expect(extractAppId("bad-.appiousercontent.com", APEX)).toBeNull();
  });

  it("rejects labels longer than 63 chars", () => {
    const tooLong = "a".repeat(64);
    expect(extractAppId(`${tooLong}.appiousercontent.com`, APEX)).toBeNull();
  });
});

describe("normalizePath", () => {
  it("maps root to index.html", () => {
    expect(normalizePath("/")).toBe("index.html");
    expect(normalizePath("")).toBe("index.html");
  });

  it("strips leading slash", () => {
    expect(normalizePath("/assets/app.js")).toBe("assets/app.js");
  });

  it("appends index.html for trailing slash", () => {
    expect(normalizePath("/about/")).toBe("about/index.html");
  });

  it("refuses traversal", () => {
    expect(normalizePath("/../etc/passwd")).toBe("index.html");
  });
});

describe("isMutableAsset", () => {
  it("flags index.html, sw.js, manifest", () => {
    expect(isMutableAsset("index.html")).toBe(true);
    expect(isMutableAsset("sw.js")).toBe(true);
    expect(isMutableAsset("manifest.json")).toBe(true);
    expect(isMutableAsset("manifest.webmanifest")).toBe(true);
  });

  it("does not flag hashed assets", () => {
    expect(isMutableAsset("assets/app-abc123.js")).toBe(false);
    expect(isMutableAsset("assets/style-def456.css")).toBe(false);
  });
});
