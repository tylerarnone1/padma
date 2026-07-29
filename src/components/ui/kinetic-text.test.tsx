import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createKineticSequenceCss,
  KineticText,
} from "./kinetic-text";

describe("KineticText sequencing", () => {
  it("generates unbounded zero-based word and character indexes", () => {
    const words = Array.from(
      { length: 14 },
      (_, index) => `word${index}`,
    );
    words[13] = "abcdefghijklmnopqrst";
    const css = createKineticSequenceCss(words.join(" "));

    expect(css).toContain(
      ".padma-word:nth-child(14){--word-i:13}",
    );
    expect(css).toContain(
      ".padma-char:nth-child(20){--char-i:19}",
    );
    expect(css).not.toContain("abcdefghijklmnopqrst");
  });

  it("uses a nonce-authorized numeric stylesheet without inline styles", () => {
    const hostileText = 'safe "}body{display:none}';
    const markup = renderToStaticMarkup(
      <KineticText text={hostileText} nonce="request-nonce" />,
    );
    const styleContents =
      /<style[^>]*>(.*?)<\/style>/.exec(markup)?.[1] ?? "";

    expect(markup).toContain('nonce="request-nonce"');
    expect(markup).not.toContain('style="');
    expect(styleContents).toMatch(
      /^(?:\.padma-(?:word|char):nth-child\(\d+\)\{--(?:word|char)-i:\d+\})+$/,
    );
    expect(styleContents).not.toContain("body");
    expect(markup).toContain("&quot;");
    expect(markup).toContain("<span>b</span>");
  });
});
