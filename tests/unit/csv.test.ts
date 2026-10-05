import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "@/lib/csv";
import { addDays, businessDateKey, startOfBusinessDay } from "@/lib/time";

describe("CSV", () => {
  it("neutralises formula injection but keeps negative numbers numeric", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+91 98765")).toBe("'+91 98765");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-10")).toBe("-10");
    expect(csvCell("-2.5")).toBe("-2.5");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvRow(['Bolt 4"', "a,b", "x\ny", null])).toBe(`"Bolt 4""","a,b","x\ny",\r\n`);
  });
});

describe("business day (IST)", () => {
  it("rolls over at midnight India time, not UTC", () => {
    expect(businessDateKey(new Date("2026-10-04T18:29:00Z"))).toBe("2026-10-04");
    expect(businessDateKey(new Date("2026-10-04T18:31:00Z"))).toBe("2026-10-05");
    expect(startOfBusinessDay("2026-10-05").toISOString()).toBe("2026-10-04T18:30:00.000Z");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
});
