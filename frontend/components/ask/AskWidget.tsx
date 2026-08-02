"use client";

import { useEffect, useRef, useState } from "react";
import { AskPanel } from "@/components/ask/AskPanel";
import { useAskWidget } from "@/components/ask/AskWidgetContext";

export function AskWidget() {
  const { open, openWidget, closeWidget, toggleWidget } = useAskWidget();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggleWidget();
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        closeWidget();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeWidget, toggleWidget]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const drawer = drawerRef.current;
    const focusables = drawer?.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables?.[0];
    const last = focusables?.[focusables.length - 1];
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !drawer) return;
      if (!focusables || focusables.length === 0) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    drawer?.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      drawer?.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    launcherRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="ask-launcher mono"
        aria-expanded={open}
        aria-controls="ask-basis-drawer"
        title="Ask Basis (⌘K / Ctrl+K)"
        onClick={() => (open ? closeWidget() : openWidget())}
      >
        ASK BASIS
      </button>

      <div
        className={`ask-widget${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={`ask-widget__backdrop${open ? " is-visible" : ""}`}
          aria-label="Close Ask Basis"
          tabIndex={open ? 0 : -1}
          onClick={closeWidget}
        />

        <div
          ref={drawerRef}
          id="ask-basis-drawer"
          className={`ask-drawer${mobile ? " ask-drawer--fullscreen" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Ask Basis"
        >
          <div className="ask-drawer__head">
            <div className="ask-drawer__head-left">
              <span className="ask-drawer__tag mono">Experimental</span>
              <span className="ask-drawer__hint mono">⌘K / Ctrl+K</span>
            </div>
            <button type="button" className="ask-drawer__close mono" onClick={closeWidget}>
              Close
            </button>
          </div>
          <AskPanel />
        </div>
      </div>
    </>
  );
}
