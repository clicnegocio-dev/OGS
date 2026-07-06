"use client";

// Acota las señales del mapa por radio alrededor del centro del municipio (Fase 1).
// "Todo" = sin filtro (ver todo lo que pertenece al municipio: punto + municipio + estado).
// Un radio muestra solo lo que cae dentro de esa distancia del centro.

const PRESETS: { label: string; km: number | null }[] = [
  { label: "Todo", km: null },
  { label: "1 km", km: 1 },
  { label: "2 km", km: 2 },
  { label: "5 km", km: 5 },
  { label: "10 km", km: 10 }
];

export function RadiusControl({
  radiusKm,
  onChange,
  count
}: {
  radiusKm: number | null;
  onChange: (km: number | null) => void;
  count: number;
}) {
  return (
    <div className="radius-control" role="group" aria-label="Acotar señales por radio">
      <div className="radius-head">
        <p className="radius-title">Radio</p>
        <span className="radius-count">{count} señales</span>
      </div>
      <div className="radius-options">
        {PRESETS.map((preset) => {
          const active = radiusKm === preset.km;
          return (
            <button
              key={preset.label}
              type="button"
              className={`radius-pill ${active ? "is-active" : ""}`}
              aria-pressed={active}
              onClick={() => onChange(preset.km)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <p className="radius-note">
        “Todo” incluye señales a nivel municipio y estado (ubicación aproximada). Un radio acota a las cercanas al
        centro.
      </p>
    </div>
  );
}
