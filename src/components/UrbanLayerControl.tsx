"use client";

import { URBAN_LAYERS, type UrbanLayerConfig, type UrbanLayerKey } from "@/config/urban-layers";

type UrbanLayerControlProps = {
  activeLayers: Record<UrbanLayerKey, boolean>;
  counts: Record<UrbanLayerKey, number>;
  onToggle: (key: UrbanLayerKey) => void;
  onSetAll: (active: boolean) => void;
};

const GROUPS = ["Vida urbana", "Economía y gobierno", "Riesgo"] as const;

export function UrbanLayerControl({ activeLayers, counts, onToggle, onSetAll }: UrbanLayerControlProps) {
  const activeCount = URBAN_LAYERS.filter((layer) => activeLayers[layer.key]).length;

  return (
    <div className="layer-panel">
      <div className="panel-head">
        <div>
          <p className="layer-title">Capas</p>
          <span>{activeCount}/{URBAN_LAYERS.length} visibles</span>
        </div>
        <div className="layer-actions" aria-label="Acciones de capas">
          <button type="button" onClick={() => onSetAll(true)}>
            Todas
          </button>
          <button type="button" onClick={() => onSetAll(false)}>
            Ninguna
          </button>
        </div>
      </div>

      <div className="layer-stack">
        {GROUPS.map((group) => (
          <section className="layer-group" key={group}>
            <h3>{group}</h3>
            {URBAN_LAYERS.filter((layer) => layer.group === group).map((layer) => (
              <LayerRow
                key={layer.key}
                layer={layer}
                active={activeLayers[layer.key]}
                count={counts[layer.key]}
                onToggle={() => onToggle(layer.key)}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function LayerRow({ layer, active, count, onToggle }: { layer: UrbanLayerConfig; active: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`layer-row ${active ? "is-active" : ""}`}
      style={{ "--layer-color": layer.color } as React.CSSProperties}
      aria-pressed={active}
      onClick={onToggle}
    >
      <span className="layer-toggle" aria-hidden="true">
        <span />
      </span>
      <span className="layer-copy">
        <span className="layer-row-top">
          <strong>{layer.label}</strong>
          <em>{count}</em>
        </span>
      </span>
    </button>
  );
}
