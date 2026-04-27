import { describe, expect, it } from "vitest";
import { getSeoData } from "./seo-content.mjs";

describe("SEO Content Dictionary", () => {
	it("should return English data by default for empty/null inputs", () => {
		const data = getSeoData(null);
		expect(data.title).toContain("Say the Word on Beat");

		const dataEmpty = getSeoData("");
		expect(dataEmpty.h1).toBe("Say the Word on Beat");
	});

	it("should return correct data for exact matches", () => {
		const data = getSeoData("es");
		expect(data.h1).toBe("Di la palabra al ritmo");
	});

	it("should handle underscore and case variations safely", () => {
		const data1 = getSeoData("PT_br");
		expect(data1.title).toContain("Diga a palavra");

		const data2 = getSeoData("ZH-hans");
		expect(data2.title).toContain("跟着节拍说单词");
	});

	it("should fallback to base language if variant is missing", () => {
		const data = getSeoData("fr-CA");
		expect(data.title).toContain("Dites le mot en rythme");
	});

	it("should handle complex Chinese variants", () => {
		expect(getSeoData("zh-Hans-CN").h1).toContain("跟着节拍说单词");
		expect(getSeoData("zh-CN").h1).toContain("跟着节拍说单词");
	});
});
