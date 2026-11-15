
import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";

type OrderRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  items: unknown;
  subtotal: number;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  source: string | null;
  notes: string | null;
};

type OrderItem = {
  name: string;
  quantity: number;
  price: number;
  total: number;
};

type OrderFilter =
  | "all"
  | "pending"
  | "awaiting_approval"
  | "processing"
  | "in_transit"
  | "delivered"
  | "cancelled";

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All orders" },
  { value: "pending", label: "Pending" },
  { value: "awaiting_approval", label: "Awaiting approval" },
  { value: "processing", label: "Processing" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const money = (value: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const statusText = (status: string) => {
  const value = status.toLowerCase();

  const labels: Record<string, string> = {
    pending: "Awaiting approval",
    confirmed: "Approved",
    processing: "Processing",
    paid: "Payment confirmed",
    shipped: "In transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Returned",
    refunded: "Refunded",
  };

  return labels[value] || value.replace(/_/g, " ");
};

const statusStyle = (status: string) => {
  const value = status.toLowerCase();

  if (value === "delivered") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }

  if (value === "cancelled" || value === "returned" || value === "refunded") {
    return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
  }

  if (value === "pending") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return "border-gold/40 bg-gold/10 text-gold";
};

const readItems = (value: unknown): OrderItem[] => {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const item =
      entry && typeof entry === "object"
        ? (entry as Record<string, unknown>)
        : {};

    const quantity = Math.max(1, Number(item.quantity ?? item.qty ?? 1) || 1);
    const price = Number(item.price ?? item.unit_price ?? 0) || 0;
    const lineTotal =
      Number(item.line_total ?? item.total ?? item.subtotal ?? price * quantity) ||
      price * quantity;

    const name =
      item.product_name ??
      item.name ??
      item.title ??
      item.product_title ??
      "Marketplace product";

    return {
      name: String(name),
      quantity,
      price,
      total: lineTotal,
    };
  });
};

const isClosedOrder = (status: string) =>
  ["delivered", "cancelled", "returned", "refunded"].includes(
    status.toLowerCase(),
  );

const isInProgress = (status: string) =>
  ["confirmed", "processing", "paid", "shipped"].includes(
    status.toLowerCase(),
  );

const matchesFilter = (order: OrderRecord, filter: OrderFilter) => {
  const status = order.status.toLowerCase();

  switch (filter) {
    case "pending":
    case "awaiting_approval":
      return status === "pending";
    case "processing":
      return ["confirmed", "processing", "paid"].includes(status);
    case "in_transit":
      return status === "shipped";
    case "delivered":
      return status === "delivered";
    case "cancelled":
      return ["cancelled", "returned", "refunded"].includes(status);
    default:
      return true;
  }
};

export const Route = createFileRoute("/account/orders")({
  head: accountHead("My Orders", "View your FleJexa orders and delivery progress."),
  component: AccountOrdersPage,
});

function AccountOrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const loadOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setOrders([]);
        setError("Please sign in to view your orders.");
        return;
      }

      // The customer ID filter works together with the database's existing
      // row-level security policy. Never fetch another customer's orders.
      const { data, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, created_at, updated_at, customer_name, items, subtotal, total, status, payment_status, payment_method, source, notes",
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      setOrders((data ?? []) as unknown as OrderRecord[]);
    } catch (err) {
      setOrders([]);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't load your orders. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();

    return () => {
      // The page does not subscribe to or modify order records.
    };
  }, [loadOrders]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !isClosedOrder(order.status)),
    [orders],
  );

  const currentOrder = activeOrders[0] ?? null;

  const deliveredCount = orders.filter(
    (order) => order.status.toLowerCase() === "delivered",
  ).length;

  const awaitingCount = orders.filter(
    (order) => order.status.toLowerCase() === "pending",
  ).length;

  const filteredOrders = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return orders.filter((order) => {
      if (!matchesFilter(order, statusFilter)) return false;
      if (!query) return true;

      const itemNames = readItems(order.items)
        .map((item) => item.name)
        .join(" ");

      return (
        order.id.toLowerCase().includes(query) ||
        itemNames.toLowerCase().includes(query) ||
        statusText(order.status).toLowerCase().includes(query)
      );
    });
  }, [orders, searchText, statusFilter]);

  const selected = selectedOrder
    ? orders.find((order) => order.id === selectedOrder) ?? null
    : null;

  if (loading) {
    return (
      <AccountPage title="My Orders" intro="Your purchases, all in one place.">
        <div className="surface flex items-center justify-center gap-3 rounded-2xl border p-12">
          <RefreshCw className="h-5 w-5 animate-spin text-gold" />
          <span className="text-sm text-muted-foreground">
            Loading your orders...
          </span>
        </div>
      </AccountPage>
    );
  }

  return (
    <AccountPage
      title="My Orders"
      intro="Your purchases, all in one place."
    >
      <div className="space-y-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadOrders(true)}
                className="mt-2 font-semibold underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Current order tracking */}
        <section className="surface rounded-2xl border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-gold" />
                <h2 className="text-base font-bold">Current Order Tracking</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Follow the latest progress of your active order.
              </p>
            </div>
            {currentOrder && (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(currentOrder.status)}`}
              >
                {statusText(currentOrder.status)}
              </span>
            )}
          </div>

          {currentOrder ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  Order #{currentOrder.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Placed {dateLabel(currentOrder.created_at)}
                </p>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {readItems(currentOrder.items).length} item line(s) ·{" "}
                {money(Number(currentOrder.total))}
              </p>

              <div className="mt-5 grid grid-cols-4 gap-1">
                {[
                  { label: "Ordered", icon: ShoppingBag },
                  { label: "Approved", icon: CheckCircle2 },
                  { label: "Processing", icon: PackageCheck },
                  { label: "Shipped", icon: Truck },
                ].map((step, index) => {
                  const status = currentOrder.status.toLowerCase();
                  const stage =
                    status === "pending"
                      ? 0
                      : status === "confirmed" || status === "paid"
                        ? 1
                        : status === "processing"
                          ? 2
                          : status === "shipped" || status === "delivered"
                            ? 3
                            : 0;
                  const complete = index <= stage;
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.label}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-full border ${
                          complete
                            ? "border-gold/50 bg-gold/10 text-gold"
                            : "border-border bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span
                        className={`text-[10px] sm:text-xs ${
                          complete
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                {currentOrder.status.toLowerCase() === "pending"
                  ? "Your order is waiting for merchant approval."
                  : currentOrder.status.toLowerCase() === "confirmed"
                    ? "Your order has been approved and is awaiting preparation."
                    : currentOrder.status.toLowerCase() === "processing"
                      ? "Your order is being prepared."
                      : currentOrder.status.toLowerCase() === "paid"
                        ? "Payment is marked as confirmed. Check the order details for its fulfilment status."
                        : currentOrder.status.toLowerCase() === "shipped"
                          ? "Your order has been marked as shipped. Courier location updates are not yet connected."
                          : "Your order status has been updated."}
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(currentOrder.id)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline"
                >
                  View tracking details <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-col items-center rounded-xl bg-muted/40 px-4 py-7 text-center">
              <Package className="h-9 w-9 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No current order</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                When you have an active order, its latest confirmed progress
                will appear here.
              </p>
              <Link
                to="/shop"
                className="btn btn-primary mt-4 inline-flex items-center gap-2"
              >
                <ShoppingBag className="h-4 w-4" /> Explore products
              </Link>
            </div>
          )}
        </section>

        {/* Order summary */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total orders",
              value: orders.length,
              icon: Package,
            },
            {
              label: "In progress",
              value: orders.filter((order) => isInProgress(order.status)).length,
              icon: Clock3,
            },
            {
              label: "Delivered",
              value: deliveredCount,
              icon: PackageCheck,
            },
            {
              label: "Awaiting approval",
              value: awaitingCount,
              icon: ArrowDownRight,
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="surface rounded-2xl border p-4"
              >
                <Icon className="h-5 w-5 text-gold" />
                <p className="mt-3 text-2xl font-bold tabular-nums">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </section>

        {/* Search and filters */}
        <section className="space-y-3">
          <div>
            <h2 className="font-bold">Find an order</h2>
            <p className="text-xs text-muted-foreground">
              Search by order number, product or status.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search your orders..."
              className="field pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={statusFilter === filter.value}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === filter.value
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border text-muted-foreground hover:border-gold/50 hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {/* Order history */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Your Order History</h2>
              <p className="text-xs text-muted-foreground">
                {filteredOrders.length} order(s) found
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadOrders(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 text-xs font-semibold text-gold hover:underline disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="surface flex flex-col items-center rounded-2xl border px-5 py-10 text-center">
              {orders.length === 0 ? (
                <>
                  <Package className="h-10 w-10 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">No orders yet</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Your confirmed marketplace orders will appear here.
                  </p>
                  <Link
                    to="/shop"
                    className="btn btn-primary mt-4 inline-flex items-center gap-2"
                  >
                    <ShoppingBag className="h-4 w-4" /> Start shopping
                  </Link>
                </>
              ) : (
                <>
                  <Search className="h-9 w-9 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">No matching orders</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try another search or choose a different status.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchText("");
                      setStatusFilter("all");
                    }}
                    className="mt-3 text-sm font-semibold text-gold hover:underline"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const items = readItems(order.items);

                return (
                  <article
                    key={order.id}
                    className="surface rounded-2xl border p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Placed {dateLabel(order.created_at)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(order.status)}`}
                      >
                        {statusText(order.status)}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {items.slice(0, 2).map((item, index) => (
                        <div
                          key={`${order.id}-${index}`}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="min-w-0 truncate text-muted-foreground">
                            {item.name} × {item.quantity}
                          </span>
                          <span className="shrink-0 font-medium">
                            {money(item.total)}
                          </span>
                        </div>
                      ))}
                      {items.length > 2 && (
                        <p className="text-xs text-muted-foreground">
                          +{items.length - 2} more item line(s)
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          Order total
                        </p>
                        <p className="font-bold">{money(Number(order.total))}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order.id)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline"
                      >
                        View details <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected order details */}
        {selected && (
          <section
            className="surface scroll-mt-6 rounded-2xl border p-4 sm:p-5"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">
                  Order #{selected.id.slice(0, 8).toUpperCase()}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Order details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="rounded-lg border p-2 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Order status</span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(selected.status)}`}
              >
                {statusText(selected.status)}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {readItems(selected.items).map((item, index) => (
                <div
                  key={`${selected.id}-detail-${index}`}
                  className="flex items-start justify-between gap-3 border-b pb-3 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Quantity: {item.quantity} · Unit price: {money(item.price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{money(item.total)}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="font-semibold">{money(Number(selected.subtotal))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Order total</p>
                <p className="font-semibold">{money(Number(selected.total))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment status</p>
                <p className="font-semibold">{statusText(selected.payment_status)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment method</p>
                <p className="font-semibold">
                  {selected.payment_method || "Not recorded"}
                </p>
              </div>
            </div>

            {selected.notes && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground">
                  Order notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{selected.notes}</p>
              </div>
            )}

            <p className="mt-4 text-[11px] text-muted-foreground">
              Last record update: {dateLabel(selected.updated_at)}
            </p>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Need help with an order?
          </p>
          <Link
            to="/account/returns"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline"
          >
            Contact support <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </AccountPage>
  );
}
