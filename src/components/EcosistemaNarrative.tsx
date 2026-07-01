"use client";

import { useEffect, useRef, useState } from "react";
import {
  BODY_PARADIGM,
  CHAIN,
  ECO_LAYERS,
  EJES,
  FLUJO,
  KERNEL_PILLARS,
  METHOD_LADDER,
  PRINCIPLES,
  SMALL_CONSEQUENCES,
  SMALL_QUOTES,
  SYMPTOMS
} from "@/data/ecosistema-content";
import Link from "next/link";
import { ReportSignalForm } from "./ReportSignalForm";

// Canal de respaldo (WhatsApp) si OIS no está configurado o el ciudadano lo prefiere.
const WHATSAPP_REPORT_HREF =
  "https://wa.me/5212291330107?text=Quiero%20reportar%20una%20se%C3%B1al%20urbana%20en%20mi%20ciudad";

export function EcosistemaNarrative({
  cityName = "tu ciudad",
  settlementSlug = "boca-del-rio"
}: {
  cityName?: string;
  settlementSlug?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeLayer, setActiveLayer] = useState(ECO_LAYERS[0].key);
  const [openSymptom, setOpenSymptom] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Reveal en scroll, respetando prefers-reduced-motion.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(".eco-reveal"));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      items.forEach((el) => el.classList.add("is-revealed"));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Coherencia de captura: el ancla #participa del hero ("Reportar una señal") abre el formulario,
  // no solo scrollea. Mismo punto de entrada, un toque.
  useEffect(() => {
    function openIfReportHash() {
      if (window.location.hash === "#participa") setReportOpen(true);
    }
    openIfReportHash();
    window.addEventListener("hashchange", openIfReportHash);
    return () => window.removeEventListener("hashchange", openIfReportHash);
  }, []);

  const layer = ECO_LAYERS.find((l) => l.key === activeLayer) ?? ECO_LAYERS[0];

  return (
    <div className="eco" ref={rootRef}>
      {/* Paradigma: la ciudad como cuerpo */}
      <section className="eco-section eco-band" id="paradigma">
        <div className="eco-container">
          <p className="eco-eyebrow eco-reveal">El paradigma</p>
          <h2 className="eco-lead eco-reveal">
            Una ciudad funciona como un cuerpo. Cuando algo falla, el sistema completo reacciona.
          </h2>
          <div className="eco-body-grid eco-reveal">
            {BODY_PARADIGM.map((part) => (
              <div className="eco-body-item" key={part.label} style={{ ["--bc" as string]: part.color }}>
                <span className="eco-body-label">{part.label}</span>
                <span className="eco-body-eq">{part.eq}</span>
                <span className="eco-body-desc">{part.desc}</span>
              </div>
            ))}
          </div>
          <p className="eco-statement eco-reveal">
            Una ciudad no se rompe de golpe. <em>Se rompe por señales que aprendemos a normalizar.</em>
          </p>
        </div>
      </section>

      {/* Método: escalera */}
      <section className="eco-section" id="metodo">
        <div className="eco-container">
          <p className="eco-eyebrow eco-reveal">El método · de lo básico a lo avanzado</p>
          <h2 className="eco-headline eco-reveal">Comprender un asentamiento, paso a paso.</h2>
          <p className="eco-text eco-reveal">
            No necesitas estudios para empezar: basta con <b>mirar tu entorno</b>. Cada nivel se lee de dos formas
            —en simple, para cualquier persona, y en método, para quien investiga— porque entender la ciudad es de todos.
          </p>
          <div className="eco-ladder eco-reveal">
            {METHOD_LADDER.map((rung) => (
              <div className="eco-rung" key={rung.n} style={{ ["--rc" as string]: rung.color }}>
                <div className="eco-rung-rail">
                  <span className="eco-rung-n">{rung.n}</span>
                </div>
                <div className="eco-rung-body">
                  <div className="eco-rung-head">
                    <span className="eco-rung-name">{rung.name}</span>
                    <span className="eco-rung-badge">{rung.badge}</span>
                  </div>
                  <p className="eco-rung-simple">
                    <b>En simple:</b> {rung.simple}
                  </p>
                  <p className="eco-rung-method">
                    <b>En método:</b> {rung.method}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ecosistema: explorador de las seis capas */}
      <section className="eco-section eco-band" id="ecosistema">
        <div className="eco-container">
          <p className="eco-eyebrow eco-reveal">El sistema</p>
          <h2 className="eco-headline eco-reveal">Seis capas que lo conectan todo.</h2>
          <p className="eco-text eco-reveal">
            Una ciudad no es solo calles y edificios. Es una red viva de seis capas que se influyen mutuamente: la
            <b> anatomía del sistema</b>. Cuando una falla, las demás lo sienten. Selecciona una capa para ver sus conexiones.
          </p>
          <div className="eco-explorer eco-reveal">
            <div className="eco-layer-tabs" role="tablist" aria-label="Capas del ecosistema urbano">
              {ECO_LAYERS.map((l) => (
                <button
                  key={l.key}
                  id={`eco-tab-${l.key}`}
                  type="button"
                  role="tab"
                  aria-selected={l.key === activeLayer}
                  aria-controls="eco-tabpanel"
                  className={`eco-ltab${l.key === activeLayer ? " is-active" : ""}`}
                  style={{ ["--ld" as string]: l.color }}
                  onClick={() => setActiveLayer(l.key)}
                >
                  <span className="eco-ltab-dot" />
                  {l.name}
                </button>
              ))}
            </div>
            <div
              className="eco-layer-detail"
              role="tabpanel"
              id="eco-tabpanel"
              aria-labelledby={`eco-tab-${layer.key}`}
              tabIndex={0}
              style={{ ["--lc" as string]: layer.color }}
              key={layer.key}
            >
              <div className="eco-ld-name">
                <span className="eco-ld-dot" style={{ background: layer.color }} />
                {layer.name}
              </div>
              <p className="eco-ld-desc">{layer.desc}</p>
              <p className="eco-ld-links-label">Cómo se conecta</p>
              <ul className="eco-ld-links">
                {layer.links.map((link) => (
                  <li key={link}>{link}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="eco-dec-phrase eco-reveal">Una decisión aquí, resuena en todas partes.</p>
        </div>
      </section>

      {/* Lo pequeño */}
      <section className="eco-section" id="pequeno">
        <div className="eco-container">
          <p className="eco-eyebrow eco-reveal">Micro decisiones, macro efectos</p>
          <h2 className="eco-headline eco-reveal">Lo pequeño también construye ciudad.</h2>
          <div className="eco-quotes eco-reveal">
            {SMALL_QUOTES.map((q) => (
              <p className="eco-quote" key={q}>
                {q}
              </p>
            ))}
          </div>
          <p className="eco-text eco-reveal">Pero cuando miles de pequeñas excepciones se repiten, dejan de ser pequeñas.</p>
          <div className="eco-cons eco-reveal">
            {SMALL_CONSEQUENCES.map((c) => (
              <p className="eco-con" key={c.text} style={{ ["--cc" as string]: c.color }}>
                {c.text}
              </p>
            ))}
          </div>
          <p className="eco-statement eco-reveal">
            Una ciudad sana no depende de una sola gran solución. Depende de muchas <em>decisiones conectadas</em>.
          </p>
        </div>
      </section>

      {/* Vemos / No vemos */}
      <section className="eco-section eco-band" id="ver">
        <div className="eco-container">
          <p className="eco-eyebrow eco-reveal">La señal y su raíz</p>
          <h2 className="eco-headline eco-reveal">Lo que vemos es la superficie. La señal real está debajo.</h2>
          <p className="eco-hint eco-reveal">Toca cada señal para descubrir su causa sistémica.</p>
          <div className="eco-symptom-grid eco-reveal">
            {SYMPTOMS.map((s, i) => (
              <button
                key={s.see}
                type="button"
                className={`eco-symptom${openSymptom === i ? " is-open" : ""}`}
                style={{ ["--sc" as string]: s.color }}
                aria-expanded={openSymptom === i}
                onClick={() => setOpenSymptom((cur) => (cur === i ? null : i))}
              >
                <span className="eco-symptom-eyebrow">Lo que vemos</span>
                <span className="eco-symptom-see">{s.see}</span>
                {openSymptom === i ? (
                  <span className="eco-symptom-reveal">
                    <span className="eco-symptom-eyebrow">Lo que no vemos</span>
                    <span className="eco-symptom-cause">{s.cause}</span>
                    <span className="eco-symptom-result">{s.result}</span>
                  </span>
                ) : (
                  <span className="eco-symptom-hint">Ver qué hay debajo ↓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 8 Ejes */}
      <section className="eco-section" id="ejes">
        <div className="eco-container">
          <p className="eco-eyebrow eco-reveal">Taxonomía universal</p>
          <h2 className="eco-headline eco-reveal">Ocho maneras en que una ciudad puede estar fallando.</h2>
          <p className="eco-text eco-reveal">
            Si las seis capas son la <b>anatomía</b> de la ciudad, los ejes son sus <b>síntomas</b>: ocho formas en que
            puede estar fallando. Cualquier señal urbana cae en uno de ellos, en cualquier ciudad del mundo.
          </p>
          <div className="eco-ejes-grid eco-reveal">
            {EJES.map((eje) => (
              <div className="eco-eje-card" key={eje.n} style={{ ["--ec" as string]: eje.color }}>
                <div className="eco-eje-n">{eje.n}</div>
                <div className="eco-eje-name">{eje.name}</div>
                <div className="eco-eje-desc">{eje.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flujo */}
      <section className="eco-section eco-band" id="flujo">
        <div className="eco-container">
          <p className="eco-eyebrow eco-reveal">Cómo funciona</p>
          <h2 className="eco-headline eco-reveal">De la señal a la acción.</h2>
          <p className="eco-text eco-reveal">
            Una observación ciudadana no es solo un reclamo. Es el primer paso de un proceso que convierte experiencias
            individuales en información compartida.
          </p>
          <div className="eco-flujo eco-reveal">
            {FLUJO.map((step, i) => (
              <div className="eco-flujo-step" key={step.n} style={{ ["--fn" as string]: step.color }}>
                <div className="eco-fs-num">{step.n}</div>
                <div className="eco-fs-label">{step.label}</div>
                <div className="eco-fs-desc">{step.desc}</div>
                {i < FLUJO.length - 1 ? <span className="eco-fs-arrow" aria-hidden="true">→</span> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Kernel / OIS */}
      <section className="eco-section" id="kernel">
        <div className="eco-container">
          <p className="eco-eyebrow eco-accent eco-reveal">El kernel · OIS</p>
          <h2 className="eco-headline eco-reveal">Un sistema vivo necesita un sistema que lo opere.</h2>
          <p className="eco-text eco-reveal">
            Leer la ciudad como un ecosistema solo sirve si algo mantiene esa lectura <b>ordenada, continua y accionable</b>.
            Esa capa es <b>OIS — Sistema de Inteligencia Operativa</b>: el kernel que convierte señales sueltas en un
            sistema con memoria, trazabilidad y criterio.
          </p>
          <div className="eco-pillars eco-reveal">
            {KERNEL_PILLARS.map((p) => (
              <div className="eco-pillar" key={p.pillar} style={{ ["--oc" as string]: p.color }}>
                <span className="eco-pillar-kicker">{p.pillar}</span>
                <span className="eco-pillar-feat">{p.feat}</span>
                <span className="eco-pillar-desc">{p.desc}</span>
              </div>
            ))}
          </div>
          <blockquote className="eco-kernel-quote eco-reveal">
            “El humano no debe apagar incendios todo el día; debe diseñar, supervisar y corregir un sistema que opere con
            <em> orden, trazabilidad y criterio</em>.”
          </blockquote>
        </div>
      </section>

      {/* Principios */}
      <section className="eco-section eco-band" id="confianza">
        <div className="eco-container">
          <p className="eco-eyebrow eco-reveal">Principios públicos</p>
          <h2 className="eco-headline eco-reveal">Cómo operamos.</h2>
          <p className="eco-text eco-reveal">
            Como proyecto que toca temas sensibles, estas reglas son públicas y no negociables.
          </p>
          <div className="eco-principles eco-reveal">
            {PRINCIPLES.map((p, i) => (
              <div className="eco-principle" key={p}>
                <span className="eco-p-n">{String(i + 1).padStart(2, "0")}</span>
                <p>{p}</p>
              </div>
            ))}
          </div>
          <div className="eco-powered eco-reveal">
            <span className="eco-powered-label">Impulsado por</span>
            <span className="eco-powered-name">
              ClicNegocio · operado por <b>OIS</b>
            </span>
            <span className="eco-powered-desc">
              El sistema de inteligencia operativa que mantiene este observatorio ordenado, trazable y vivo — con
              supervisión humana.
            </span>
          </div>
        </div>
      </section>

      {/* Participa */}
      <section className="eco-section" id="participa">
        <div className="eco-container">
          <p className="eco-eyebrow eco-accent eco-reveal">
            Participa · {cityName}
          </p>
          <h2 className="eco-headline eco-reveal">La ciudad la leen quienes la habitan.</h2>
          <p className="eco-text eco-reveal">
            Ningún observatorio ve el sistema completo desde un escritorio. Lo ve quien cruza la calle inundada, quien
            camina la banqueta rota, quien atiende el local sin clientes. Cada señal que reportas no es una queja: es
            información que, sumada a otras de la misma zona, podrá volverse un patrón útil cuando la capa analítica esté lista.
          </p>
          {reportOpen ? (
            <ReportSignalForm
              settlementSlug={settlementSlug}
              cityName={cityName}
              whatsappHref={WHATSAPP_REPORT_HREF}
              onClose={() => setReportOpen(false)}
            />
          ) : (
            <div className="eco-cta-row eco-reveal">
              <button type="button" className="eco-btn eco-btn-primary" onClick={() => setReportOpen(true)}>
                Reportar una señal
              </button>
              <a className="eco-btn eco-btn-ghost" href="#ecosistema">
                Explorar las capas
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Cierre / manifiesto */}
      <section className="eco-section eco-cierre" id="cierre">
        <div className="eco-container">
          <div className="eco-chain eco-reveal">
            {CHAIN.map((line, i) => (
              <p className="eco-chain-ln" key={line} style={{ paddingLeft: `${i * 28}px` }}>
                {line}
              </p>
            ))}
          </div>
          <h2 className="eco-manifesto eco-reveal">
            No es una queja.
            <br />
            <em>Es una señal.</em>
          </h2>
          <p className="eco-cierre-sub eco-reveal">
            La ciudad no mejora cuando todos se quejan por separado. Mejora cuando sus señales se vuelven visibles.
          </p>
        </div>
        <footer className="eco-footer">
          <span className="eco-footer-name">Ecosistema Urbano</span>
          <span className="eco-footer-tag">Nada está aislado · Impulsado por ClicNegocio, operado por OIS</span>
          <Link
            className="eco-footer-link"
            href="/fuentes"
            style={{ color: "var(--accent)", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}
          >
            Fuentes de datos →
          </Link>
        </footer>
      </section>
    </div>
  );
}
