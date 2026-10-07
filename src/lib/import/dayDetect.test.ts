import { describe, expect, it } from "vitest";
import { detectDayForCard, detectDayNumber, detectDayTitle, normalizeDayLabel, splitTags } from "./dayDetect";

describe("detectDayNumber", () => {
  it.each([
    ["Day1", 1],
    ["Day01", 1],
    ["Day_1", 1],
    ["Day-1", 1],
    ["day1", 1],
    ["Day 1", 1],
    ["DAY_017", 17],
    ["CCNA::Day_05", 5],
    ["JITL::Day18::STP", 18],
    ["Day 63 - SDN", 63],
  ])("%s → %d", (input, expected) => {
    expect(detectDayNumber(input)).toBe(expected);
  });

  it.each(["Sunday1", "today", "days", "OSPF", "", "Day0"])("%s → null", (input) => {
    expect(detectDayNumber(input)).toBeNull();
  });
});

describe("normalizeDayLabel", () => {
  it("normalizes variants", () => {
    for (const v of ["Day1", "Day01", "Day_1", "Day-1", "day1"]) expect(normalizeDayLabel(v)).toBe("Day 1");
  });
});

describe("detectDayForCard", () => {
  it("prefers tags, picks lowest day", () => {
    expect(detectDayForCard(["ccna", "Day_12", "Day_11"], "CCNA::Day 40")).toBe(11);
  });
  it("falls back to deck name", () => {
    expect(detectDayForCard(["ccna"], "CCNA::Day 40 - DHCP")).toBe(40);
  });
  it("uses explicit day column", () => {
    expect(detectDayForCard(["Day_1"], null, "7")).toBe(7);
  });
  it("falls back to Section numbering when there is no Day", () => {
    expect(detectDayForCard([], "Flackbox CCNA 200-301 v1.1b::Section 03")).toBe(3);
    expect(detectDayForCard(["Day_7"], "Flackbox::Section 03")).toBe(7);
    expect(detectDayTitle("Flackbox CCNA 200-301 v1.1b::Section 03")).toBe("Section 3");
    expect(detectDayTitle("Course::Lesson 4 - VLANs")).toBe("VLANs");
  });
  it("returns null when nothing found", () => {
    expect(detectDayForCard(["ospf"], "CCNA")).toBeNull();
  });
});

describe("splitTags / detectDayTitle", () => {
  it("splits anki tags", () => {
    expect(splitTags("  Day_01 CCNA::OSI  Day_01 ")).toEqual(["Day_01", "CCNA::OSI"]);
  });
  it("extracts titles", () => {
    expect(detectDayTitle("JITL CCNA::Day 05 - Ethernet LAN Switching")).toBe("Ethernet LAN Switching");
    expect(detectDayTitle("Day_05")).toBeNull();
  });
});
