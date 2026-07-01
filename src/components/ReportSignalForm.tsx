"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { URBAN_LAYERS } from "@/config/urban-layers";
import { EJES } from "@/data/ecosistema-content";

// Formulario de captura de señal ciudadana (Fase 1, A2). POSTea a /api/urban/report, que reenvía a la
// puerta pública de OIS. Honesto: muestra señales individuales; NO promete patrones agregados (T2 aún
// no existe en OIS). Si OIS no está configurado, degrada al respaldo de WhatsApp.

type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "ok"; message: string; reply: string | null; handoff: boolean }
  | { status: "fallback"; note: string }
  | { status: "error"; message: string };

const SEVERITIES = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

export function ReportSignalForm({
  settlementSlug,
  cityName,
  whatsappHref,
  onClose,
}: {
  settlementSlug: string;
  cityName: string;
  whatsappHref: string;
  onClose: () => void;
}) {
  const [reporterName, setReporterName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [layer, setLayer] = useState<string>(URBAN_LAYERS[0].key);
  const [eje, setEje] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [zone, setZone] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "denied" | "unsupported">("idle");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  // Geo es de EU (no de OIS). Opt-in explícito; se redondea en el borde (~100 m) por privacidad.
  function captureLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoState("unsupported");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("idle");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  // A11y: al abrir el form, llevar el foco a su encabezado; al enviar con éxito, al bloque de resultado.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  useEffect(() => {
    if (state.status === "ok") resultRef.current?.focus();
  }, [state.status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.status === "sending") return;
    if (!email.trim() && !phone.trim()) {
      setState({ status: "error", message: "Deja al menos un canal de contacto (correo o teléfono)." });
      return;
    }
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/urban/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterName,
          email,
          phone,
          layer,
          eje,
          type,
          severity,
          title,
          description,
          settlement: settlementSlug,
          zone,
          lat: geo?.lat,
          lng: geo?.lng,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.configured === false) {
        setState({ status: "fallback", note: data.note ?? "Envío directo no disponible; usa WhatsApp." });
        return;
      }
      if (!res.ok) {
        setState({ status: "error", message: data.detail || data.error || "No se pudo enviar." });
        return;
      }
      setState({
        status: "ok",
        message: data.message ?? "Señal recibida.",
        reply: data.reply ?? null,
        handoff: Boolean(data.handoff),
      });
    } catch {
      setState({ status: "error", message: "No se pudo enviar. Revisa tu conexión." });
    }
  }

  if (state.status === "ok") {
    return (
      <div className="eco-report eco-report-result eco-reveal is-revealed" role="status" ref={resultRef} tabIndex={-1}>
        <p className="eco-report-ok">✓ {state.message}</p>
        {state.reply ? <p className="eco-report-reply">{state.reply}</p> : null}
        {state.handoff ? <p className="eco-report-note">Una persona del equipo dará seguimiento.</p> : null}
        <p className="eco-report-note">
          Por ahora mostramos señales individuales; los patrones por zona llegan cuando la capa
          analítica esté lista.
        </p>
        <button type="button" className="eco-btn eco-btn-ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form className="eco-report eco-reveal is-revealed" onSubmit={handleSubmit}>
      <div className="eco-report-head">
        <h3 className="eco-report-title" ref={headingRef} tabIndex={-1}>
          Reportar una señal · {cityName}
        </h3>
        <button type="button" className="eco-report-x" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>

      <div className="eco-report-grid">
        <label className="eco-field">
          <span>Tu nombre *</span>
          <input value={reporterName} onChange={(e) => setReporterName(e.target.value)} required maxLength={200} />
        </label>
        <label className="eco-field">
          <span>Correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} />
        </label>
        <label className="eco-field">
          <span>Teléfono</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} inputMode="tel" />
        </label>
        <label className="eco-field">
          <span>Capa</span>
          <select value={layer} onChange={(e) => setLayer(e.target.value)}>
            {URBAN_LAYERS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="eco-field">
          <span>Eje (síntoma)</span>
          <select value={eje} onChange={(e) => setEje(e.target.value)}>
            <option value="">— sin eje —</option>
            {EJES.map((x) => (
              <option key={x.n} value={`${x.n} ${x.name}`}>
                {x.n} · {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="eco-field">
          <span>Tipo</span>
          <input value={type} onChange={(e) => setType(e.target.value)} placeholder="inundación, bache, foco…" maxLength={80} />
        </label>
        <label className="eco-field">
          <span>Severidad</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="eco-field eco-field-wide">
          <span>Zona / colonia</span>
          <input value={zone} onChange={(e) => setZone(e.target.value)} maxLength={120} />
        </label>
        <label className="eco-field eco-field-wide">
          <span>Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>
        <label className="eco-field eco-field-wide">
          <span>¿Qué observas? *</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} maxLength={1500} />
        </label>
      </div>

      <div className="eco-field eco-field-wide">
        <span>Ubicación de la señal</span>
        {geo ? (
          <div className="eco-report-geo">
            <span>
              📍 {geo.lat.toFixed(3)}, {geo.lng.toFixed(3)} (aprox.)
            </span>
            <button type="button" className="eco-report-geo-clear" onClick={() => setGeo(null)}>
              Quitar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="eco-btn eco-btn-ghost eco-report-geo-btn"
            onClick={captureLocation}
            disabled={geoState === "locating"}
          >
            {geoState === "locating" ? "Ubicando…" : "Usar mi ubicación actual"}
          </button>
        )}
        {geoState === "denied" ? <small>No se pudo obtener la ubicación (permiso denegado).</small> : null}
        {geoState === "unsupported" ? <small>Tu navegador no permite compartir ubicación.</small> : null}
      </div>

      <p className="eco-report-hint">
        Pedimos un canal de contacto (correo o teléfono) para dar seguimiento. La ubicación es opcional y
        se guarda aproximada (~100 m), no exacta.
      </p>

      <div role="alert" aria-live="assertive">
        {state.status === "error" ? <p className="eco-report-err">{state.message}</p> : null}
        {state.status === "fallback" ? (
          <p className="eco-report-err">
            {state.note}{" "}
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              Reportar por WhatsApp →
            </a>
          </p>
        ) : null}
      </div>

      <div className="eco-cta-row">
        <button type="submit" className="eco-btn eco-btn-primary" disabled={state.status === "sending"}>
          {state.status === "sending" ? "Enviando…" : "Enviar señal"}
        </button>
        <a className="eco-btn eco-btn-ghost" href={whatsappHref} target="_blank" rel="noopener noreferrer">
          O por WhatsApp
        </a>
      </div>
    </form>
  );
}
