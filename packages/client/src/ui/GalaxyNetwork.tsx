import { t } from "@wc/data";
import { useEffect, useState } from "preact/hooks";
import {
  buyP2POrder,
  createP2POrder,
  getCommander,
  getGalaxyApiMode,
  getWalletSummary,
  listChatMessages,
  listP2POrders,
  requestUsdtWithdrawal,
  saveWalletProfile,
  sendChatMessage,
  setCommanderName,
  subscribeToGalaxyChanges,
  type GalaxyChatMessage,
  type P2POrder,
  type WalletNetwork,
  type WalletSummary,
} from "../api/galaxyApi.ts";
import { actions, useStore } from "./store.ts";

const TRADE_ITEMS = ["wood", "stone", "scrap"] as const;
const NETWORKS: WalletNetwork[] = ["TRC20", "BEP20", "Polygon", "Solana", "ERC20"];

export function GalaxyNetwork() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "market">("chat");
  const [commanderName, setCommanderNameState] = useState(() => getCommander().name);
  const [messages, setMessages] = useState<GalaxyChatMessage[]>([]);
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [wallet, setWallet] = useState<WalletSummary>({ balance: 0, profile: { address: "", network: "TRC20" } });
  const [chatText, setChatText] = useState("");
  const [itemId, setItemId] = useState<(typeof TRADE_ITEMS)[number]>("wood");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0.1);
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<WalletNetwork>("TRC20");
  const [withdrawalAmount, setWithdrawalAmount] = useState(1);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const mode = getGalaxyApiMode();
  const inventory = (id: string) => s.marketResources.find((resource) => resource.id === id)?.count ?? 0;

  useEffect(() => {
    if (!open) return;
    let active = true;
    const refresh = async () => {
      try {
        const [nextMessages, nextOrders, nextWallet] = await Promise.all([listChatMessages(), listP2POrders(), getWalletSummary()]);
        if (!active) return;
        setMessages(nextMessages);
        setOrders(nextOrders);
        setWallet(nextWallet);
      } catch (reason) {
        console.error("Could not refresh Galaxy Network data", reason);
        if (active) setError(t("galaxy.error.request"));
      }
    };
    void refresh();
    const unsubscribe = subscribeToGalaxyChanges(() => void refresh());
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!walletOpen) return;
    void getWalletSummary().then((summary) => {
      setWallet(summary);
      setAddress(summary.profile.address);
      setNetwork(summary.profile.network);
      setWithdrawalAmount(summary.balance || 1);
    }).catch((reason: unknown) => {
      console.error("Could not read the USDT wallet", reason);
      setError(t("galaxy.error.request"));
    });
  }, [walletOpen]);

  async function submitChat(event: Event) {
    event.preventDefault();
    setError("");
    try {
      const commander = setCommanderName(commanderName);
      setCommanderNameState(commander.name);
      await sendChatMessage(chatText);
      setChatText("");
      setMessages(await listChatMessages());
    } catch (reason) {
      console.error("Could not send the global chat message", reason);
      setError(t("galaxy.error.request"));
    }
  }

  async function sellResource(event: Event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const amount = Math.floor(quantity);
    if (amount < 1 || amount > inventory(itemId)) {
      setError(t("galaxy.market.not_enough"));
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError(t("galaxy.market.invalid_price"));
      return;
    }
    if (!actions.marketTake(itemId, amount)) {
      setError(t("galaxy.market.not_enough"));
      return;
    }
    setBusy(true);
    try {
      await createP2POrder({ itemId, quantity: amount, price });
      setNotice(t("galaxy.market.offer_created"));
      setOrders(await listP2POrders());
    } catch (reason) {
      actions.marketGive(itemId, amount);
      console.error("Could not publish the P2P offer", reason);
      setError(t("galaxy.error.request"));
    } finally {
      setBusy(false);
    }
  }

  async function buyOrder(order: P2POrder, amount: number) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const receipt = await buyP2POrder(order.id, amount);
      actions.marketGive(order.itemId, amount);
      setNotice(t("galaxy.market.purchase_done", { amount: receipt.total.toFixed(2), fee: receipt.fee.toFixed(2) }));
      const [nextOrders, nextWallet] = await Promise.all([listP2POrders(), getWalletSummary()]);
      setOrders(nextOrders);
      setWallet(nextWallet);
    } catch (reason) {
      console.error("Could not buy the P2P offer", reason);
      setError(t("galaxy.error.request"));
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress(event: Event) {
    event.preventDefault();
    setError("");
    try {
      const profile = await saveWalletProfile({ address, network });
      setWallet((current) => ({ ...current, profile }));
      setNotice(t("galaxy.wallet.saved"));
    } catch (reason) {
      console.error("Could not save the wallet profile", reason);
      setError(t("galaxy.error.request"));
    }
  }

  async function withdraw(event: Event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await requestUsdtWithdrawal(withdrawalAmount);
      setNotice(t("galaxy.wallet.withdrawal_requested"));
      setWallet(await getWalletSummary());
    } catch (reason) {
      console.error("Could not request the USDT withdrawal", reason);
      setError(t("galaxy.error.request"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button class="galaxy-network-trigger" data-testid="galaxy-network-open" onClick={() => setOpen(!open)}>
        ✦ {t("galaxy.title")} {open ? "−" : "+"}
      </button>
      {open && (
        <aside class="galaxy-network" data-testid="galaxy-network">
          <header class="galaxy-network-head">
            <div>
              <b>{t("galaxy.title")}</b>
              <small>{t(mode === "worker" ? "galaxy.mode.worker" : "galaxy.mode.local")}</small>
            </div>
            <button class="galaxy-close" onClick={() => setOpen(false)} aria-label={t("ui.close")}>×</button>
          </header>
          <nav class="galaxy-tabs">
            <button class={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>{t("galaxy.chat.title")}</button>
            <button class={tab === "market" ? "on" : ""} onClick={() => setTab("market")}>{t("galaxy.market.title")}</button>
            <button onClick={() => { setError(""); setWalletOpen(true); }}>{t("galaxy.wallet.title")}</button>
          </nav>
          {tab === "chat" ? (
            <section class="galaxy-chat">
              <label class="galaxy-commander">
                <span>{t("galaxy.chat.commander")}</span>
                <input maxLength={24} value={commanderName} onInput={(event) => setCommanderNameState((event.currentTarget as HTMLInputElement).value)} />
              </label>
              <div class="galaxy-messages" data-testid="galaxy-chat-messages">
                {messages.map((message) => (
                  <p key={message.id}>
                    <b>{message.commanderName}</b> <small>{new Date(message.createdAt).toLocaleTimeString()}</small>
                    <span>{message.text}</span>
                  </p>
                ))}
                {messages.length === 0 && <p class="galaxy-empty">{t("galaxy.chat.empty")}</p>}
              </div>
              <form class="galaxy-chat-form" onSubmit={submitChat}>
                <input value={chatText} maxLength={300} placeholder={t("galaxy.chat.placeholder")} onInput={(event) => setChatText((event.currentTarget as HTMLInputElement).value)} />
                <button disabled={!chatText.trim()}>{t("galaxy.chat.send")}</button>
              </form>
            </section>
          ) : (
            <section class="galaxy-market">
              <div class="galaxy-balance">{t("galaxy.wallet.balance")}: <b>{wallet.balance.toFixed(2)} USDT</b></div>
              <form class="galaxy-sell-form" onSubmit={sellResource}>
                <label>
                  <span>{t("galaxy.market.resource")}</span>
                  <select value={itemId} onChange={(event) => setItemId((event.currentTarget as HTMLSelectElement).value as (typeof TRADE_ITEMS)[number])}>
                    {TRADE_ITEMS.map((id) => <option value={id} key={id}>{t(`item.${id}`)} · {inventory(id)}</option>)}
                  </select>
                </label>
                <label>
                  <span>{t("galaxy.market.quantity")}</span>
                  <input type="number" min="1" max={Math.max(1, inventory(itemId))} step="1" value={quantity} onInput={(event) => setQuantity(Number((event.currentTarget as HTMLInputElement).value))} />
                </label>
                <label>
                  <span>{t("galaxy.market.price")}</span>
                  <input type="number" min="0.0001" step="0.01" value={price} onInput={(event) => setPrice(Number((event.currentTarget as HTMLInputElement).value))} />
                </label>
                <button class="galaxy-primary" disabled={busy || inventory(itemId) < 1}>{t("galaxy.market.sell")}</button>
              </form>
              <p class="galaxy-fee-note">{t("galaxy.market.fee_note")}</p>
              <div class="galaxy-offers">
                {orders.map((order) => {
                  const own = order.sellerId === getCommander().id;
                  const amount = Math.max(1, Math.min(order.remaining, Math.floor(buyQuantities[order.id] ?? 1)));
                  const total = Math.round(order.price * amount * 10000) / 10000;
                  return (
                    <article class="galaxy-offer" key={order.id}>
                      <div><b>{t(`item.${order.itemId}`)}</b><small>{t("galaxy.market.seller", { name: order.sellerName })}</small></div>
                      <div class="galaxy-offer-price"><b>{order.price.toFixed(2)} USDT</b><small>{t("galaxy.market.available", { quantity: order.remaining })}</small></div>
                      <input aria-label={t("galaxy.market.quantity")} type="number" min="1" max={order.remaining} value={amount}
                        onInput={(event) => setBuyQuantities({ ...buyQuantities, [order.id]: Number((event.currentTarget as HTMLInputElement).value) })} />
                      <button disabled={own || busy || wallet.balance < total} onClick={() => void buyOrder(order, amount)}>
                        {own ? t("galaxy.market.your_offer") : t("galaxy.market.buy")}
                      </button>
                    </article>
                  );
                })}
                {orders.length === 0 && <p class="galaxy-empty">{t("galaxy.market.empty")}</p>}
              </div>
            </section>
          )}
          {error && <p class="galaxy-error" role="alert">{error}</p>}
          {notice && <p class="galaxy-notice" role="status">{notice}</p>}
        </aside>
      )}
      {walletOpen && (
        <div class="galaxy-wallet-backdrop" data-testid="galaxy-wallet-modal">
          <section class="galaxy-wallet-modal" role="dialog" aria-modal="true" aria-labelledby="galaxy-wallet-heading">
            <button class="galaxy-close" onClick={() => setWalletOpen(false)} aria-label={t("ui.close")}>×</button>
            <h2 id="galaxy-wallet-heading">{t("galaxy.wallet.title")}</h2>
            <p>{t("galaxy.wallet.balance")}: <b>{wallet.balance.toFixed(2)} USDT</b></p>
            <form onSubmit={saveAddress}>
              <label>{t("galaxy.wallet.network")}
                <select value={network} onChange={(event) => setNetwork((event.currentTarget as HTMLSelectElement).value as WalletNetwork)}>
                  {NETWORKS.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                </select>
              </label>
              <label>{t("galaxy.wallet.address")}
                <input value={address} maxLength={160} onInput={(event) => setAddress((event.currentTarget as HTMLInputElement).value)} placeholder={t("galaxy.wallet.address_placeholder")} />
              </label>
              <button class="galaxy-primary">{t("galaxy.wallet.save")}</button>
            </form>
            <form onSubmit={withdraw}>
              <label>{t("galaxy.wallet.withdraw_amount")}
                <input type="number" min="0.01" step="0.01" max={wallet.balance} value={withdrawalAmount} onInput={(event) => setWithdrawalAmount(Number((event.currentTarget as HTMLInputElement).value))} />
              </label>
              <button disabled={busy || wallet.balance <= 0 || !address}>{t("galaxy.wallet.withdraw")}</button>
            </form>
            <p class="galaxy-fee-note">{t(mode === "local" ? "galaxy.wallet.withdraw_notice.local" : "galaxy.wallet.withdraw_notice.worker")}</p>
            {error && <p class="galaxy-error" role="alert">{error}</p>}
            {notice && <p class="galaxy-notice" role="status">{notice}</p>}
          </section>
        </div>
      )}
    </>
  );
}
