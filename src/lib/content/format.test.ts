import { describe, expect, it } from "vitest";
import { formatCardHtml, looksLikeCli } from "./format";
import { sanitizeCardHtml, normalizeForHash } from "./sanitize";

describe("looksLikeCli", () => {
  it.each(["show ip interface brief", "R1(config-if)# ip address 10.0.0.1 255.255.255.0", "SW1#show vlan brief", "switchport mode trunk", "no shutdown"])(
    "detects %s",
    (l) => expect(looksLikeCli(l)).toBe(true),
  );
  it.each(["What does a router do?", "Show the answer to the class please now.", "Interfaces connect devices together in a LAN and WAN environment."])(
    "ignores prose %s",
    (l) => expect(looksLikeCli(l)).toBe(false),
  );
});

describe("formatCardHtml", () => {
  it("formats plain text with CLI lines", () => {
    const out = formatCardHtml("Which command shows interfaces?\nshow ip interface brief");
    expect(out).toContain('<code class="cli">show ip interface brief</code>');
    expect(out).toContain("<br>");
  });
  it("marks CLI lines inside html", () => {
    const out = formatCardHtml("<div>Command:</div><div>show running-config</div>");
    expect(out).toContain('<code class="cli">show running-config</code>');
  });
  it("leaves pre blocks alone", () => {
    const out = formatCardHtml("<pre>show version</pre>");
    expect(out).toBe("<pre>show version</pre>");
  });
  it("rewrites relative images", () => {
    expect(formatCardHtml('<img src="ospf 1.png">')).toContain('src="/api/media/f/ospf%201.png"');
    expect(formatCardHtml('<img src="https://x.com/a.png">')).toContain('src="https://x.com/a.png"');
  });
  it("renders cloze", () => {
    expect(formatCardHtml("OSPF uses {{c1::cost}}", "front")).toContain("[…]");
    expect(formatCardHtml("OSPF uses {{c1::cost}}", "back")).toContain("cost");
  });
});

describe("sanitize", () => {
  it("strips scripts and handlers but keeps tables", () => {
    const out = sanitizeCardHtml('<table><tr><td onclick="x()">a</td></tr></table><script>alert(1)</script>');
    expect(out).toBe("<table><tr><td>a</td></tr></table>");
  });
  it("normalizes for hashing", () => {
    expect(normalizeForHash("<b>Hello</b>&nbsp; World")).toBe("hello world");
  });
});
