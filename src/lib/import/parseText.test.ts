import { describe, expect, it } from "vitest";
import { parseDelimitedText } from "./parseText";

describe("parseDelimitedText", () => {
  it("parses Anki plain-text export with headers", () => {
    const text = [
      "#separator:tab",
      "#html:true",
      "#guid column:1",
      "#deck column:2",
      "#tags column:5",
      "abc123\tCCNA::Day 01\tWhat is a router?\tForwards packets\tDay_01 devices",
      'def456\tCCNA::Day 02\t"Multi\nline"\tAnswer\tDay_02',
    ].join("\n");
    const t = parseDelimitedText(text, "deck.txt");
    expect(t.rows).toHaveLength(2);
    expect(t.suggested).toMatchObject({ sourceId: 0, deck: 1, front: 2, back: 3, tags: 4 });
    expect(t.rows[1][2]).toBe("Multi\nline");
  });

  it("parses CSV with header row", () => {
    const t = parseDelimitedText('Front,Back,Tags\n"Q1, with comma",A1,Day1\nQ2,A2,Day2', "x.csv");
    expect(t.columns).toEqual(["Front", "Back", "Tags"]);
    expect(t.rows[0][0]).toBe("Q1, with comma");
    expect(t.suggested).toMatchObject({ front: 0, back: 1, tags: 2 });
  });

  it("detects a tags column without headers", () => {
    const t = parseDelimitedText("Q1\tA1\tDay_03 osi\nQ2\tA2\tDay_04", "x.tsv");
    expect(t.suggested).toMatchObject({ front: 0, back: 1, tags: 2 });
  });
});
