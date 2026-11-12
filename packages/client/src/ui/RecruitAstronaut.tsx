import { t } from "@wc/data";
import { useState } from "preact/hooks";
import { actions, useStore } from "./store.ts";
import type { RecruitRole } from "@wc/sim";

export function RecruitAstronaut() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<RecruitRole>("explorer");
  const [error, setError] = useState(false);
  const s = useStore();
  if (s.tutorial) return null;
  return (
    <>
      <button class="recruit-trigger" data-testid="recruit-open" onClick={() => { setError(false); setOpen(true); }}>
        ✦ {t("recruit.open")}
      </button>
      {open && (
        <div class="recruit-overlay" data-testid="recruit-modal">
          <section class="recruit-window" role="dialog" aria-modal="true" aria-labelledby="recruit-title">
            <button class="recruit-close" onClick={() => setOpen(false)} aria-label={t("ui.close")}>×</button>
            <p class="recruit-kicker">{t("recruit.kicker")}</p>
            <h2 id="recruit-title">{t("recruit.title")}</h2>
            <p class="recruit-note">{t("recruit.test_notice")}</p>
            <div class="recruit-options">
              <button class={role === "explorer" ? "on" : ""} data-testid="recruit-explorer" onClick={() => { setRole("explorer"); setError(false); }}>
                <b>{t("recruit.explorer")}</b>
                <small>{t("recruit.explorer.desc")}</small>
              </button>
              <button class={role === "robotic_engineer" ? "on" : ""} data-testid="recruit-engineer" onClick={() => { setRole("robotic_engineer"); setError(false); }}>
                <b>{t("recruit.engineer")}</b>
                <small>{t("recruit.engineer.desc")}</small>
              </button>
            </div>
            <button
              class="recruit-pay"
              data-testid="recruit-simulate-payment"
              onClick={() => {
                if (actions.recruit(role)) setOpen(false);
                else setError(true);
              }}
            >
              {t("recruit.simulate")}
            </button>
            {error && <p class="recruit-error" role="alert">{t("recruit.no_space")}</p>}
          </section>
        </div>
      )}
    </>
  );
}
