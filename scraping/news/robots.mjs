// robots.txt: descarga + parseo + decisión de permiso (honestidad por diseño).
//
// El scraper de EU respeta robots.txt EN TIEMPO DE EJECUCIÓN, no por comentario. Antes de
// enriquecer una nota (Capa 2: traer título+asunto del <head>), preguntamos aquí si la ruta está
// permitida para nuestro User-Agent. Si el medio vuelve a bloquear (p.ej. `Disallow: /`), la Capa 2
// se degrada sola al título-desde-slug (ver scrape-news.mjs). Nunca forzamos.
//
// Implementa el subconjunto de robots.txt que estos medios usan: grupos User-agent (con `*`),
// Disallow/Allow con prefijo de ruta, y la regla estándar de "match más largo gana" (RFC 9309).

// Parsea el texto de un robots.txt en grupos {agents:Set, rules:[{allow, path}]}.
export function parseRobots(text) {
  const groups = [];
  let current = null;
  // Un bloque de User-agent contiguos comparte reglas hasta la primera línea non-agent.
  let collectingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!collectingAgents || !current) {
        current = { agents: new Set(), rules: [] };
        groups.push(current);
        collectingAgents = true;
      }
      current.agents.add(value.toLowerCase());
    } else if (field === "allow" || field === "disallow") {
      collectingAgents = false;
      if (!current) {
        current = { agents: new Set(["*"]), rules: [] };
        groups.push(current);
      }
      // Disallow vacío = "permitir todo"; se ignora como regla (no restringe).
      if (field === "disallow" && value === "") continue;
      current.rules.push({ allow: field === "allow", path: value });
    } else {
      collectingAgents = false; // sitemap, host, crawl-delay… no cambian el permiso de ruta.
    }
  }
  return groups;
}

// Elige el grupo que aplica a `ua`: coincidencia por token (case-insensitive) o, si no, el grupo `*`.
function groupFor(groups, ua) {
  const uaLc = ua.toLowerCase();
  let star = null;
  for (const g of groups) {
    for (const a of g.agents) {
      if (a === "*") star = star || g;
      else if (uaLc.includes(a)) return g; // el UA declara este token → gana el específico
    }
  }
  return star;
}

// ¿Está permitida la ruta para este UA? Regla RFC 9309: gana la regla cuyo `path` (prefijo) es el
// más largo que hace match; empate → Allow gana. Sin grupo aplicable o sin reglas → permitido.
export function isPathAllowed(groups, path, ua) {
  const group = groupFor(groups, ua);
  if (!group || group.rules.length === 0) return true;

  let best = null; // { allow, len }
  for (const rule of group.rules) {
    if (matchesPrefix(path, rule.path)) {
      const len = rule.path.length;
      if (!best || len > best.len || (len === best.len && rule.allow)) {
        best = { allow: rule.allow, len };
      }
    }
  }
  return best ? best.allow : true;
}

// Match de prefijo con los comodines básicos de robots: `*` (cualquier secuencia) y `$` (fin de URL).
function matchesPrefix(path, pattern) {
  if (pattern === "" || pattern === "/") return pattern === "/" ? path.startsWith("/") : true;
  if (!pattern.includes("*") && !pattern.includes("$")) return path.startsWith(pattern);
  // Traduce el patrón a regex anclado al inicio.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
  const anchored = escaped.endsWith("$") ? `^${escaped.slice(0, -1)}$` : `^${escaped}`;
  return new RegExp(anchored).test(path);
}

// Fábrica con caché por host: fetch de robots.txt una vez y respuesta a isAllowed(url).
// Fail-open acotado: si robots.txt no se puede leer (404/red), asumimos permitido SOLO para las
// rutas de contenido (no assets), que es la postura por defecto de estos medios. Cualquier error de
// red al traerlo se registra vía onWarn.
export function createRobotsChecker({ fetchText, ua, onWarn }) {
  const cache = new Map(); // host → groups | null (null = no disponible → fail-open)

  async function groupsFor(host, origin) {
    if (cache.has(host)) return cache.get(host);
    let groups = null;
    try {
      const text = await fetchText(`${origin}/robots.txt`);
      groups = parseRobots(text);
    } catch (error) {
      onWarn?.(`robots.txt de ${host} no disponible (${error.message}); se asume permitido para contenido.`);
      groups = null;
    }
    cache.set(host, groups);
    return groups;
  }

  return {
    async isAllowed(url) {
      let u;
      try {
        u = new URL(url);
      } catch {
        return false;
      }
      const groups = await groupsFor(u.host, u.origin);
      if (!groups) return true; // fail-open acotado
      return isPathAllowed(groups, u.pathname, ua);
    }
  };
}
