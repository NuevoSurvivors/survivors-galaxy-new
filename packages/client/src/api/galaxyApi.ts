/**
 * Cloudflare Worker routes: /chat, /market/orders, /market/orders/:id/buy,
 * /wallet, /wallet/withdrawals and /payments/invoices. Set VITE_GALAXY_API_URL
 * to the Worker base URL. Treat commander headers as
 * display hints only; the Worker must authenticate accounts and validate every transaction.
 */
export type WalletNetwork = "TRC20" | "BEP20" | "Polygon" | "Solana" | "ERC20";
export type GalaxyApiMode = "local" | "worker";

export interface Commander {
  id: string;
  name: string;
}

export interface GalaxyChatMessage {
  id: string;
  commanderName: string;
  text: string;
  createdAt: string;
}

export interface P2POrder {
  id: string;
  sellerId: string;
  sellerName: string;
  itemId: string;
  quantity: number;
  price: number;
  remaining: number;
  createdAt: string;
}

export interface WalletProfile {
  address: string;
  network: WalletNetwork;
}

export interface WalletSummary {
  balance: number;
  profile: WalletProfile;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  address: string;
  network: WalletNetwork;
  status: "pending";
  createdAt: string;
}

export interface PaymentInvoice {
  id: string;
  paymentUrl: string | null;
  status: string;
  amount: number;
}

export interface PurchaseReceipt {
  order: P2POrder;
  quantity: number;
  total: number;
  fee: number;
  balance: number;
}

interface LocalState {
  commanders: Commander[];
  chat: GalaxyChatMessage[];
  orders: P2POrder[];
  balances: Record<string, number>;
  profiles: Record<string, WalletProfile>;
  withdrawals: WithdrawalRequest[];
  invoices: PaymentInvoice[];
}

const STORAGE_KEY = "galaxy-network-v1";
const COMMANDER_KEY = "galaxy-commander-v1";
const CHANGE_EVENT = "galaxy-network-change";
const PLATFORM_FEE = 0.08;
const DEFAULT_PROFILE: WalletProfile = { address: "", network: "TRC20" };
const NETWORKS: readonly WalletNetwork[] = ["TRC20", "BEP20", "Polygon", "Solana", "ERC20"];
const TRADE_ITEMS = ["wood", "stone", "scrap"] as const;
const workerUrl = import.meta.env.VITE_GALAXY_API_URL?.replace(/\/+$/, "");

const emptyState = (): LocalState => ({ commanders: [], chat: [], orders: [], balances: {}, profiles: {}, withdrawals: [], invoices: [] });
const roundUsdt = (amount: number) => Math.round(amount * 1_000_000) / 1_000_000;

function isMarketItem(itemId: string): itemId is (typeof TRADE_ITEMS)[number] {
  return TRADE_ITEMS.some((id) => id === itemId);
}

function parseOrder(value: unknown): P2POrder {
  if (!value || typeof value !== "object") throw new Error("Invalid market order response.");
  const order = value as P2POrder;
  if (
    typeof order.id !== "string" ||
    typeof order.sellerId !== "string" ||
    typeof order.sellerName !== "string" ||
    typeof order.itemId !== "string" ||
    !isMarketItem(order.itemId) ||
    !Number.isSafeInteger(order.quantity) ||
    order.quantity <= 0 ||
    !Number.isSafeInteger(order.remaining) ||
    order.remaining < 0 ||
    order.remaining > order.quantity ||
    !Number.isFinite(order.price) ||
    order.price <= 0 ||
    typeof order.createdAt !== "string"
  ) throw new Error("Invalid market order response.");
  return order;
}

function parseWalletSummary(value: unknown): WalletSummary {
  if (!value || typeof value !== "object") throw new Error("Invalid wallet response.");
  const summary = value as WalletSummary;
  if (
    !Number.isFinite(summary.balance) ||
    summary.balance < 0 ||
    !summary.profile ||
    typeof summary.profile.address !== "string" ||
    !NETWORKS.includes(summary.profile.network)
  ) throw new Error("Invalid wallet response.");
  return summary;
}

function parseInvoice(value: unknown): PaymentInvoice {
  if (!value || typeof value !== "object") throw new Error("Invalid payment invoice response.");
  const invoice = value as PaymentInvoice;
  if (typeof invoice.id !== "string" || !invoice.id || typeof invoice.status !== "string" || !Number.isFinite(invoice.amount) || invoice.amount <= 0) {
    throw new Error("Invalid payment invoice response.");
  }
  if (invoice.paymentUrl !== null) {
    let url: URL;
    try {
      url = new URL(invoice.paymentUrl);
    } catch {
      throw new Error("Invalid payment URL.");
    }
    if (url.protocol !== "https:") throw new Error("Payment URL must use HTTPS.");
  }
  return invoice;
}

function readLocalState(): LocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const value = JSON.parse(raw) as Partial<LocalState>;
    return {
      commanders: Array.isArray(value.commanders) ? value.commanders : [],
      chat: Array.isArray(value.chat) ? value.chat : [],
      orders: Array.isArray(value.orders) ? value.orders : [],
      balances: value.balances && typeof value.balances === "object" ? value.balances : {},
      profiles: value.profiles && typeof value.profiles === "object" ? value.profiles : {},
      withdrawals: Array.isArray(value.withdrawals) ? value.withdrawals : [],
      invoices: Array.isArray(value.invoices) ? value.invoices : [],
    };
  } catch (error) {
    console.error("Could not read the local Galaxy Network data", error);
    return emptyState();
  }
}

function writeLocalState(state: LocalState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function makeId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getGalaxyApiMode(): GalaxyApiMode {
  return workerUrl ? "worker" : "local";
}

export function getCommander(): Commander {
  let commander: Commander | null = null;
  try {
    commander = JSON.parse(localStorage.getItem(COMMANDER_KEY) ?? "null") as Commander | null;
  } catch (error) {
    console.error("Could not read the local commander profile", error);
  }
  if (typeof commander?.id === "string" && typeof commander.name === "string" && commander.id && commander.name) return commander;
  const created = { id: makeId(), name: "Comandante" };
  localStorage.setItem(COMMANDER_KEY, JSON.stringify(created));
  return created;
}

export function setCommanderName(name: string): Commander {
  const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 24);
  if (!cleanName) throw new Error("Commander name cannot be empty.");
  const commander = { ...getCommander(), name: cleanName };
  localStorage.setItem(COMMANDER_KEY, JSON.stringify(commander));
  const state = readLocalState();
  const index = state.commanders.findIndex((entry) => entry.id === commander.id);
  if (index >= 0) state.commanders[index] = commander;
  else state.commanders.push(commander);
  writeLocalState(state);
  return commander;
}

async function workerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!workerUrl) throw new Error("Galaxy Network Worker is not configured.");
  const commander = getCommander();
  const response = await fetch(`${workerUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Commander-Id": commander.id,
      "X-Commander-Name": commander.name,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Galaxy Network request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function subscribeToGalaxyChanges(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export async function listChatMessages(): Promise<GalaxyChatMessage[]> {
  if (workerUrl) return workerRequest("/chat");
  return readLocalState().chat.slice(-100);
}

export async function sendChatMessage(text: string): Promise<GalaxyChatMessage> {
  const cleanText = text.trim().slice(0, 300);
  if (!cleanText) throw new Error("Chat message cannot be empty.");
  if (workerUrl) return workerRequest("/chat", { method: "POST", body: JSON.stringify({ text: cleanText }) });
  const commander = getCommander();
  const message: GalaxyChatMessage = { id: makeId(), commanderName: commander.name, text: cleanText, createdAt: new Date().toISOString() };
  const state = readLocalState();
  state.chat = [...state.chat, message].slice(-100);
  writeLocalState(state);
  return message;
}

export async function listP2POrders(): Promise<P2POrder[]> {
  if (workerUrl) {
    const orders = await workerRequest<unknown>("/market/orders");
    if (!Array.isArray(orders)) throw new Error("Invalid market order list response.");
    return orders.map(parseOrder);
  }
  return readLocalState().orders.filter((order) => order.remaining > 0).map(parseOrder);
}

export async function createP2POrder(input: { itemId: string; quantity: number; price: number }): Promise<P2POrder> {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0 || !Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Enter a quantity and a price greater than zero.");
  }
  if (!isMarketItem(input.itemId)) throw new Error("This resource cannot be sold on the market.");
  if (workerUrl) return parseOrder(await workerRequest<unknown>("/market/orders", { method: "POST", body: JSON.stringify(input) }));
  const commander = getCommander();
  const roundedPrice = roundUsdt(input.price);
  if (roundedPrice <= 0) throw new Error("Offer price is below the supported precision.");
  const order: P2POrder = {
    id: makeId(),
    sellerId: commander.id,
    sellerName: commander.name,
    itemId: input.itemId,
    quantity: input.quantity,
    price: roundedPrice,
    remaining: input.quantity,
    createdAt: new Date().toISOString(),
  };
  const state = readLocalState();
  state.orders.unshift(order);
  writeLocalState(state);
  return order;
}

export async function buyP2POrder(orderId: string, quantity: number): Promise<PurchaseReceipt> {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Enter a valid purchase quantity.");
  if (workerUrl) {
    const value = await workerRequest<unknown>(`/market/orders/${encodeURIComponent(orderId)}/buy`, { method: "POST", body: JSON.stringify({ quantity }) });
    if (!value || typeof value !== "object") throw new Error("Invalid purchase response.");
    const receipt = value as PurchaseReceipt;
    const order = parseOrder(receipt.order);
    if (!Number.isSafeInteger(receipt.quantity) || receipt.quantity !== quantity || !Number.isFinite(receipt.total) || receipt.total < 0 ||
        !Number.isFinite(receipt.fee) || receipt.fee < 0 || !Number.isFinite(receipt.balance) || receipt.balance < 0) {
      throw new Error("Invalid purchase response.");
    }
    return { ...receipt, order };
  }
  const commander = getCommander();
  const state = readLocalState();
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order || order.remaining < quantity) throw new Error("This offer no longer has that quantity available.");
  if (order.sellerId === commander.id) throw new Error("You cannot buy your own offer.");
  const total = roundUsdt(order.price * quantity);
  const fee = roundUsdt(total * PLATFORM_FEE);
  const balance = state.balances[commander.id] ?? 0;
  if (balance < total) throw new Error("Your USDT balance is too low.");
  state.balances[commander.id] = roundUsdt(balance - total);
  state.balances[order.sellerId] = roundUsdt((state.balances[order.sellerId] ?? 0) + total - fee);
  order.remaining -= quantity;
  writeLocalState(state);
  return { order: parseOrder(order), quantity, total, fee, balance: state.balances[commander.id] };
}

export async function getWalletSummary(): Promise<WalletSummary> {
  if (workerUrl) return parseWalletSummary(await workerRequest<unknown>("/wallet"));
  const commander = getCommander();
  const state = readLocalState();
  return { balance: state.balances[commander.id] ?? 0, profile: state.profiles[commander.id] ?? DEFAULT_PROFILE };
}

export async function saveWalletProfile(profile: WalletProfile): Promise<WalletProfile> {
  if (!NETWORKS.includes(profile.network)) throw new Error("Choose a supported wallet network.");
  if (profile.address.trim().length > 160) throw new Error("Wallet address is too long.");
  if (workerUrl) {
    const saved = await workerRequest<unknown>("/wallet", { method: "PUT", body: JSON.stringify(profile) });
    if (!saved || typeof saved !== "object" || typeof (saved as WalletProfile).address !== "string" ||
        !NETWORKS.includes((saved as WalletProfile).network)) throw new Error("Invalid wallet profile response.");
    return saved as WalletProfile;
  }
  const commander = getCommander();
  const normalized = { ...profile, address: profile.address.trim() };
  const state = readLocalState();
  state.profiles[commander.id] = normalized;
  writeLocalState(state);
  return normalized;
}

export async function requestUsdtWithdrawal(amount: number): Promise<WithdrawalRequest> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a withdrawal amount greater than zero.");
  const normalizedAmount = roundUsdt(amount);
  if (normalizedAmount <= 0) throw new Error("Withdrawal amount is below the supported precision.");
  if (workerUrl) return workerRequest("/wallet/withdrawals", { method: "POST", body: JSON.stringify({ amount: normalizedAmount }) });
  const commander = getCommander();
  const state = readLocalState();
  const profile = state.profiles[commander.id] ?? DEFAULT_PROFILE;
  if (!profile.address) throw new Error("Save a payout address before requesting a withdrawal.");
  const balance = state.balances[commander.id] ?? 0;
  if (normalizedAmount > balance) throw new Error("Your USDT balance is too low.");
  const request: WithdrawalRequest = { id: makeId(), amount: normalizedAmount, address: profile.address, network: profile.network, status: "pending", createdAt: new Date().toISOString() };
  state.balances[commander.id] = roundUsdt(balance - normalizedAmount);
  state.withdrawals.unshift(request);
  writeLocalState(state);
  return request;
}

export async function createNowPaymentsInvoice(input: { amount: number; orderId: string; description: string }): Promise<PaymentInvoice> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Invoice amount must be greater than zero.");
  if (workerUrl) return parseInvoice(await workerRequest<unknown>("/payments/invoices", { method: "POST", body: JSON.stringify({ ...input, currency: "USDT" }) }));
  const invoice: PaymentInvoice = { id: makeId(), paymentUrl: null, status: "mock_pending", amount: input.amount };
  const state = readLocalState();
  state.invoices.unshift(invoice);
  writeLocalState(state);
  return invoice;
}

export async function getNowPaymentsInvoice(invoiceId: string): Promise<PaymentInvoice> {
  if (workerUrl) return parseInvoice(await workerRequest<unknown>(`/payments/invoices/${encodeURIComponent(invoiceId)}`));
  const invoice = readLocalState().invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) throw new Error("Local payment invoice was not found.");
  return invoice;
}
