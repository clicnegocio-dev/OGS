import { describe, it, expect } from "vitest";
import { isSafeHttpUrl } from "@/lib/url";

// Guard de enlaces de terceros. La cobertura importa porque el sourceUrl nace del sitemap scrapeado
// (entrada no confiable) y se pinta como href en 3 superficies: solo http/https deben pasar.
describe("isSafeHttpUrl", () => {
  it("acepta http y https", () => {
    expect(isSafeHttpUrl("https://xeu.mx/nota")).toBe(true);
    expect(isSafeHttpUrl("http://ejemplo.com")).toBe(true);
  });

  it("rechaza esquemas peligrosos", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeHttpUrl("ftp://host/x")).toBe(false);
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("rechaza vacío/nulo/no-URL", () => {
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl("no es una url")).toBe(false);
  });
});
