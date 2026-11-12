import { t } from "@wc/data";
import { useState } from "preact/hooks";
import { createNowPaymentsInvoice, getNowPaymentsInvoice, type PaymentInvoice } from "../api/galaxyApi.ts";
import { actions, useStore } from "./store.ts";
import type { RecruitRole } from "@wc/sim";

export function RecruitAstronaut() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<RecruitRole>("explorer");
  const [error, setError] = useState<"space" | "payment" | false>(false);
  const [invoice, setInvoice] = useState<PaymentInvoice | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const s = useStore();
  if (s.tutorial) return null;
  return (
    <>
      <button class="recruit-trigger" data-testid="recruit-open" onClick={() => { setError(false); setInvoice(null); setOpen(true); }}>
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
              <button class={role === "explorer" ? "on" : ""} data-testid="recruit-explorer" onClick={() => { setRole("explorer"); setError(false); setInvoice(null); }}>
                <b>{t("recruit.explorer")}</b>
                <small>{t("recruit.explorer.desc")}</small>
              </button>
              <button class={role === "robotic_engineer" ? "on" : ""} data-testid="recruit-engineer" onClick={() => { setRole("robotic_engineer"); setError(false); setInvoice(null); }}>
                <b>{t("recruit.engineer")}</b>
                <small>{t("recruit.engineer.desc")}</small>
              </button>
            </div>
            <button
              class="recruit-pay"
              data-testid="recruit-simulate-payment"
              onClick={() => {
                if (actions.recruit(role)) setOpen(false);
                else setError("space");
              }}
            >
              {t("recruit.simulate")}
            </button>
            <button
              class="recruit-live-pay"
              data-testid="recruit-nowpayments"
              disabled={paymentBusy}
              onClick={async () => {
                setError(false);
                setPaymentBusy(true);
                try {
                  const amount = role === "explorer" ? 2 : 5;
                  setInvoice(await createNowPaymentsInvoice({ amount, orderId: `astronaut-${role}-${Date.now()}`, description: t(role === "explorer" ? "recruit.explorer" : "recruit.engineer") }));
                } catch (reason) {
                  console.error("Could not create the astronaut payment invoice", reason);
                  setError("payment");
                } finally {
                  setPaymentBusy(false);
                }
              }}
            >
              {t("recruit.nowpayments")}
            </button>
            {invoice && (
              <div class="recruit-invoice" data-testid="recruit-invoice">
                {invoice.paymentUrl ? (
                  <a href={invoice.paymentUrl} target="_blank" rel="noopener noreferrer">{t("recruit.open_invoice")}</a>
                ) : (
                  <p>{t("recruit.invoice_local")}</p>
                )}
                <button
                  disabled={paymentBusy || !invoice.paymentUrl}
                  onClick={async () => {
                    setPaymentBusy(true);
                    setError(false);
                    try {
                      const status = await getNowPaymentsInvoice(invoice.id);
                      setInvoice(status);
                      if (status.status === "finished") {
                        if (actions.recruit(role)) setOpen(false);
                        else setError("space");
                      }
                    } catch (reason) {
                      console.error("Could not verify the astronaut payment", reason);
                      setError("payment");
                    } finally {
                      setPaymentBusy(false);
                    }
                  }}
                >
                  {t("recruit.check_payment")}
                </button>
                <p class="recruit-note">{t("recruit.payment_notice")}</p>
              </div>
            )}
            {error && <p class="recruit-error" role="alert">{t(error === "space" ? "recruit.no_space" : "recruit.payment_error")}</p>}
          </section>
        </div>
      )}
    </>
  );
}
