"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { CommandLink } from "@/lib/commands";

// Buscador ⌘K / Ctrl+K (patrón "command palette" de World Monitor): salta a asentamiento, colonia,
// código postal o vista. Amarra por teclado la navegación entre mapa, tablero, dossier y fuentes.
// Montado global en el layout; recibe el índice ya construido en el server.

export function CommandPalette({ commands }: { commands: CommandLink[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo global: ⌘K / Ctrl+K abre/cierra; Escape cierra.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setOpen((o) => !o);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.sub ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function go(cmd: CommandLink) {
    setOpen(false);
    router.push(cmd.href);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const cmd = filtered[active];
      if (cmd) go(cmd);
    }
  }

  const groups = useMemo(() => [...new Set(filtered.map((c) => c.group))], [filtered]);

  return (
    <>
      <button
        type="button"
        className="cmdk-launcher"
        onClick={() => setOpen(true)}
        aria-label="Buscar y navegar (Ctrl o Cmd + K)"
      >
        <span className="cmdk-launcher-icon">⌘K</span>
        <span className="cmdk-launcher-text">Buscar</span>
      </button>

      {open ? (
        <div className="cmdk-overlay" role="dialog" aria-modal="true" aria-label="Buscar y navegar" onClick={() => setOpen(false)}>
          <div className="cmdk" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
            <input
              ref={inputRef}
              className="cmdk-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar asentamiento, colonia, código postal, vista…"
              aria-label="Buscar"
            />
            <div className="cmdk-list" role="listbox" aria-label="Resultados">
              {filtered.length === 0 ? <p className="cmdk-empty">Sin resultados.</p> : null}
              {groups.map((group) => (
                <div key={group} className="cmdk-group">
                  <p className="cmdk-group-title">{group}</p>
                  {filtered
                    .filter((c) => c.group === group)
                    .map((c) => {
                      const idx = filtered.indexOf(c);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={idx === active}
                          className={`cmdk-item ${idx === active ? "is-active" : ""}`}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => go(c)}
                        >
                          <span className="cmdk-item-label">{c.label}</span>
                          {c.sub ? <span className="cmdk-item-sub">{c.sub}</span> : null}
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
            <div className="cmdk-foot">↑↓ mover · ↵ abrir · esc cerrar</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
