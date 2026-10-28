import { describe, expect, it } from "vitest";
import { emphasis } from "./vite-plugin";

describe("emphasis", () => {
  it("closes bold and italics that end on an apostrophe, which CommonMark leaves open", () => {
    expect(emphasis("**l'**aigua i **he d'**anar")).toBe("<strong>l'</strong>aigua i <strong>he d'</strong>anar");
    expect(emphasis("*l'*agafo")).toBe("<em>l'</em>agafo");
  });

  it("leaves list markers and lone asterisks alone", () => {
    expect(emphasis("* un element\n- *cursiva* i 3 * 4")).toBe("* un element\n- <em>cursiva</em> i 3 * 4");
  });
});
