import { t } from "@wc/data";

export function MainMenuAd() {
  return (
    <aside class="ad-placeholder ad-placeholder-menu" aria-label={t("galaxy.ads.label")} data-testid="ad-menu">
      {t("galaxy.ads.menu")}
    </aside>
  );
}

export function AdBanner() {
  return (
    <aside class="ad-placeholder ad-placeholder-banner" aria-label={t("galaxy.ads.label")} data-testid="ad-banner">
      {t("galaxy.ads.banner")}
    </aside>
  );
}
