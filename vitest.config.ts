import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest cubre la SEGUNDA PASADA que la auditoría estática no alcanzó: las funciones puras y contratos
// (scoping de señales, dossier por CP, ajuste lineal, guard de URLs, geo). Entorno `node` porque nada
// aquí necesita DOM — son transformaciones puras, no componentes. Los alias replican tsconfig.json.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@scraping": fileURLToPath(new URL("./scraping", import.meta.url))
    }
  }
});
