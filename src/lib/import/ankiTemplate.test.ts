import { describe, expect, it } from "vitest";
import { renderAnkiCard, cardOrdinals, type AnkiNotetype } from "./ankiTemplate";
import { sanitizeCardHtml } from "../content/sanitize";

const ioe: AnkiNotetype = {
  name: "Image Occlusion Enhanced",
  kind: "normal",
  fields: ["ID (hidden)", "Header", "Image", "Question Mask", "Footer", "Remarks", "Sources", "Extra 1", "Extra 2", "Answer Mask", "Original Mask"],
  templates: [
    {
      name: "IO Card",
      qfmt: '{{#Image}}<div id="io-header">{{Header}}</div><div id="io-wrapper"><div id="io-overlay">{{Question Mask}}</div><div id="io-original">{{Image}}</div></div><div id="io-footer">{{Footer}}</div><script>var x=1</script>{{/Image}}',
      afmt: '{{#Image}}<div id="io-header">{{Header}}</div><div id="io-wrapper"><div id="io-overlay">{{Answer Mask}}</div><div id="io-original">{{Image}}</div></div>{{#Remarks}}<div id="io-extra">{{Remarks}}</div>{{/Remarks}}<button id="io-revl-btn" onclick="toggle()">Toggle Masks</button>{{/Image}}',
    },
  ],
};

describe("renderAnkiCard", () => {
  it("renders Image Occlusion Enhanced notes with masks instead of the hidden ID", () => {
    const values = ["25be42c1a3764350893c38ff8ee2d6c9-oa-1", "OSI Layer", '<img src="osi.png">', '<img src="osi-1-Q.svg">', "", "Layer 4", "", "", "", '<img src="osi-1-A.svg">', ""];
    const { front, back } = renderAnkiCard(ioe, values, { tags: "", deck: "Section 03", ord: 0 });
    expect(front).not.toContain("25be42c1");
    expect(front).toContain('src="osi-1-Q.svg"');
    expect(front).toContain('src="osi.png"');
    expect(back).toContain('src="osi-1-A.svg"');
    const clean = sanitizeCardHtml(back);
    expect(clean).toContain('class="io-wrapper"');
    expect(clean).not.toContain("Toggle Masks");
    expect(clean).not.toContain("onclick");
    expect(sanitizeCardHtml(front)).not.toContain("script");
  });

  it("renders basic notes and drops {{FrontSide}} from the back", () => {
    const basic: AnkiNotetype = { name: "Basic", kind: "normal", fields: ["Front", "Back"], templates: [{ name: "Card 1", qfmt: "{{Front}}", afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}" }] };
    expect(renderAnkiCard(basic, ["Q?", "A!"], { tags: "", deck: "", ord: 0 })).toEqual({ front: "Q?", back: "A!" });
  });

  it("renders one card per cloze number", () => {
    const cloze: AnkiNotetype = { name: "Cloze", kind: "cloze", fields: ["Text", "Back Extra"], templates: [{ name: "Cloze", qfmt: "{{cloze:Text}}", afmt: "{{cloze:Text}}<br>{{Back Extra}}" }] };
    const values = ["OSPF AD is {{c1::110}}, EIGRP is {{c2::90}}", ""];
    expect(cardOrdinals(cloze, values)).toEqual([0, 1]);
    const c2 = renderAnkiCard(cloze, values, { tags: "", deck: "", ord: 1 });
    expect(c2.front).toBe('OSPF AD is 110, EIGRP is <span class="cloze">[…]</span>');
    expect(c2.back).toContain('<span class="cloze">90</span>');
  });

  it("renders Anki's built-in image occlusion shapes", () => {
    const io: AnkiNotetype = { name: "Image Occlusion", kind: "cloze", fields: ["Occlusion", "Image", "Header", "Back Extra", "Comments"], templates: [{ name: "IO", qfmt: "", afmt: "" }] };
    const values = [
      "{{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.1:oi=1}}{{c2::image-occlusion:rect:left=.5:top=.5:width=.2:height=.2:oi=1}}",
      '<img src="net.png">',
      "Name the device",
      "",
      "",
    ];
    const { front, back } = renderAnkiCard(io, values, { tags: "", deck: "", ord: 0 });
    expect(front).toContain("Name the device");
    expect(front).toContain('class="io-shape io-active" style="left:10.000%;top:20.000%;width:30.000%;height:10.000%"');
    expect(front).toContain("io-inactive");
    expect(back).toContain("io-revealed");
    expect(sanitizeCardHtml(front)).toContain("left:10.000%");
  });
});
