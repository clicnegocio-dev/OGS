// Smoke test de contratos de API. REQUIERE un server vivo escuchando en ECOSISTEMA_BASE_URL
// (por defecto el dev server local). No levanta nada por sí mismo: arranca la app primero.
// TODO(CI): cablear a CI — levantar el server, exportar ECOSISTEMA_BASE_URL y correr este script
// como gate (sale con código 1 si algún contrato falla).
const baseUrl = process.env.ECOSISTEMA_BASE_URL || "http://127.0.0.1:3001";
const settlements = ["boca-del-rio", "veracruz"];
// #37: timeout duro por request; algunas rutas (denue/boundary) pueden tardar.
const REQUEST_TIMEOUT_MS = 20000;

async function main() {
  for (const settlement of settlements) {
    await assertPage(settlement);
    await assertDenue(settlement);
    await assertBoundary(settlement);
    await assertProfile(settlement);
    await assertNews(settlement);
    await assertMarket(settlement);
  }
}

async function assertPage(settlement) {
  const response = await fetch(`${baseUrl}/${settlement}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  assert(response.ok, `${settlement} page returned ${response.status}`);
}

async function assertDenue(settlement) {
  const response = await fetch(
    `${baseUrl}/api/urban/denue?settlement=${settlement}&mode=area&condition=todos&detail=map`,
    {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }
  );
  assert(response.ok, `${settlement} DENUE returned ${response.status}`);
  const payload = await response.json();
  assert(payload.settlement?.id === settlement, `${settlement} DENUE settlement mismatch`);
  assert(Number.isInteger(payload.total), `${settlement} DENUE total is missing`);
  assert(payload.total >= 0, `${settlement} DENUE total must be >= 0`);
  assert(Array.isArray(payload.signals), `${settlement} DENUE signals missing`);
  assert(payload.summary, `${settlement} DENUE summary missing`);
  assert(
    !payload.signals.some((signal) => "metadata" in signal),
    `${settlement} map payload should not include metadata`
  );
}

async function assertBoundary(settlement) {
  const response = await fetch(`${baseUrl}/api/urban/boundary?settlement=${settlement}&method=denue`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  assert(response.ok, `${settlement} boundary returned ${response.status}`);
  const payload = await response.json();
  assert(payload.settlement?.id === settlement, `${settlement} boundary settlement mismatch`);
  assert(payload.boundary?.geometry?.type, `${settlement} boundary geometry missing`);
  assert(payload.precision, `${settlement} boundary precision missing`);
}

async function assertProfile(settlement) {
  const response = await fetch(`${baseUrl}/api/urban/profile?settlement=${settlement}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  assert(response.ok, `${settlement} profile returned ${response.status}`);
  const payload = await response.json();
  assert(payload.settlement?.id === settlement, `${settlement} profile settlement mismatch`);
  assert(payload.confidence === "official", `${settlement} profile confidence should be official`);
  assert(payload.dimensions?.descriptive, `${settlement} profile missing descriptive dimension`);
  assert(payload.dimensions?.diagnostic, `${settlement} profile missing diagnostic dimension`);
  assert(payload.dimensions?.predictive, `${settlement} profile missing predictive dimension`);
  assert(payload.dimensions?.prescriptive, `${settlement} profile missing prescriptive dimension`);
  assert(
    typeof payload.dimensions.descriptive.population?.value === "number",
    `${settlement} profile missing population value`
  );
}

async function assertNews(settlement) {
  const response = await fetch(`${baseUrl}/api/urban/news?settlement=${settlement}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  assert(response.ok, `${settlement} news returned ${response.status}`);
  const payload = await response.json();
  assert(payload.confidence === "reported", `${settlement} news should be confidence=reported`);
  assert(Array.isArray(payload.signals), `${settlement} news signals missing`);
  // #37: un dataset vacío no debe pasar silenciosamente. Exigimos métricas numéricas; y SOLO
  // cuando hay señales mapeadas (mapped>0) verificamos el contrato espacial sobre `signals`.
  // (Antes, signals.every(...) sobre array vacío retornaba true y un dataset vacío "pasaba".)
  assert(typeof payload.total === "number", `${settlement} news total must be numeric`);
  const mapped = typeof payload.mapped === "number" ? payload.mapped : payload.signals.length;
  if (mapped > 0) {
    assert(payload.signals.length > 0, `${settlement} news reports mapped>0 but signals array is empty`);
    assert(
      payload.signals.every(
        (signal) =>
          ["punto", "municipio", "estado"].includes(signal.geoScope) &&
          (signal.geoScope === "estado" || signal.settlementId === settlement)
      ),
      `${settlement} news signals must have a valid geoScope and belong to the settlement (estado excepted)`
    );
  }
  assert(typeof payload.vintage === "string", `${settlement} news vintage missing`);
}

async function assertMarket(settlement) {
  // Debe responder 200 con/sin credenciales ML (degrada honestamente, no rompe).
  const response = await fetch(`${baseUrl}/api/urban/market?settlement=${settlement}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  assert(response.ok, `${settlement} market returned ${response.status}`);
  const payload = await response.json();
  assert(typeof payload.configured === "boolean", `${settlement} market must expose configured boolean`);
  if (payload.configured && !payload.error) {
    assert(Number.isInteger(payload.inventory), `${settlement} market inventory missing`);
    assert(Array.isArray(payload.listings), `${settlement} market listings missing`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main()
  .then(() => {
    console.log(`API contracts OK: ${settlements.join(", ")}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
