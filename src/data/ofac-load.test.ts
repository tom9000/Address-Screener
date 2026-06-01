import { describe, expect, it } from "vitest";
import { parseOfacCsv } from "./ofac-load.js";

describe("parseOfacCsv", () => {
  it("parses address and quoted name columns", () => {
    const csv = [
      "address,name",
      '0x08723392Ed15743cc38513C4925f5e6be5c17243,"LAZARUS GROUP"',
      '0x0330070FD38Ec3bB94F58FA55D40368271E9e54A,"AMNOKGANG TECHNOLOGY DEVELOPMENT COMPANY"',
    ].join("\n");

    const { set, names } = parseOfacCsv(csv);
    expect(set.has("0x08723392ed15743cc38513c4925f5e6be5c17243")).toBe(true);
    expect(names.get("0x0330070fd38ec3bb94f58fa55d40368271e9e54a")).toBe(
      "AMNOKGANG TECHNOLOGY DEVELOPMENT COMPANY",
    );
  });
});
