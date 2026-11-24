import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Home,
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
  order_reference: string | null;
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
  | "awaiting_approval"
  | "in_progress"
  | "processing"
  | "in_transit"
  | "delivered"
  | "cancelled";

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All orders" },
  { value: "awaiting_approval", label: "Pending / Awaiting approval" },
  { value: "in_progress", label: "In progress" },
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

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const dateTimeLabel = (value: string | null | undefined) => {
  if (!value) return "Order date unavailable";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Order date unavailable"
    : date.toLocaleString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const statusText = (status: string) => {
  const value = status.toLowerCase();

  const labels: Record<string, string> = {
    pending: "Awaiting approval",
    awaiting_approval: "Awaiting approval",
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

const paymentStatusText = (status: string) => {
  const value = (status || "").toLowerCase();

  const labels: Record<string, string> = {
    pending: "Payment pending",
    unpaid: "Unpaid",
    paid: "Paid",
    completed: "Paid",
    successful: "Paid",
    failed: "Payment failed",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
  };

  return labels[value] || value.replace(/_/g, " ") || "Not recorded";
};

const statusStyle = (status: string) => {
  const value = status.toLowerCase();

  if (value === "delivered") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }

  if (["cancelled", "returned", "refunded"].includes(value)) {
    return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
  }

  if (["pending", "awaiting_approval"].includes(value)) {
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
    const price =
      Number(item.price ?? item.unit_price ?? item.unitPrice ?? 0) || 0;

    const lineTotal =
      Number(
        item.line_total ??
          item.lineTotal ??
          item.total ??
          item.subtotal ??
          price * quantity,
      ) || price * quantity;

    const name =
      item.product_name ??
      item.productName ??
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

const isCancelledOrder = (status: string) =>
  ["cancelled", "returned", "refunded"].includes(status.toLowerCase());

const isClosedOrder = (status: string) =>
  ["delivered", "cancelled", "returned", "refunded"].includes(
    status.toLowerCase(),
  );

const isInProgress = (status: string) =>
  ["confirmed", "processing", "shipped"].includes(status.toLowerCase());

const isAwaitingApproval = (status: string) =>
  ["pending", "awaiting_approval", "awaiting approval"].includes(
    status.toLowerCase(),
  );

const matchesFilter = (order: OrderRecord, filter: OrderFilter) => {
  const status = order.status.toLowerCase();

  switch (filter) {
    case "awaiting_approval":
      return isAwaitingApproval(status);
    case "in_progress":
      return isInProgress(status);
    case "processing":
      return status === "processing";
    case "in_transit":
      return status === "shipped";
    case "delivered":
      return status === "delivered";
    case "cancelled":
      return isCancelledOrder(status);
    default:
      return true;
  }
};

const trackingStage = (status: string) => {
  const value = status.toLowerCase();

  if (value === "delivered") return 4;
  if (value === "shipped") return 3;
  if (value === "processing") return 2;
  if (value === "confirmed") return 1;

  return 0;
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
  const [summaryFilter, setSummaryFilter] = useState<OrderFilter>("all");
  const [ordersView, setOrdersView] = useState<OrderFilter | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    () => new Set(),
  );

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

      // Only retrieve orders belonging to the signed-in customer.
      const { data, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, order_reference, created_at, updated_at, customer_name, items, subtotal, total, status, payment_status, payment_method, source, notes",
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
  }, [loadOrders]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !isClosedOrder(order.status)),
    [orders],
  );

  const selected = selectedOrder
    ? orders.find((order) => order.id === selectedOrder) ?? null
    : null;

  // Show the latest active order, or the latest order if all are closed.
  const currentOrder = selected ?? activeOrders[0] ?? orders[0] ?? null;

  const deliveredCount = orders.filter(
    (order) => order.status.toLowerCase() === "delivered",
  ).length;

  const awaitingCount = orders.filter((order) =>
    isAwaitingApproval(order.status),
  ).length;

  const inProgressCount = orders.filter((order) =>
    isInProgress(order.status),
  ).length;

  const filteredOrders = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return orders.filter((order) => {
      if (!matchesFilter(order, summaryFilter)) return false;
      if (!matchesFilter(order, statusFilter)) return false;
      if (!query) return true;

      const itemNames = readItems(order.items)
        .map((item) => item.name)
        .join(" ")
        .toLowerCase();

      const shortReference = order.id.slice(0, 8).toLowerCase();

      return (
        order.id.toLowerCase().includes(query) ||
        shortReference.includes(query) ||
        itemNames.includes(query) ||
        statusText(order.status).toLowerCase().includes(query)
      );
    });
  }, [orders, searchText, statusFilter, summaryFilter]);

  const toggleDate = (orderId: string) => {
    setExpandedDates((previous) => {
      const next = new Set(previous);

      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);

      return next;
    });
  };

  const selectSummary = (filter: OrderFilter) => {
    setSummaryFilter(filter);
    setStatusFilter("all");
    setSearchText("");
    setSelectedOrder(null);
    setOrdersView(filter);
  };

  if (loading) {
    return (
      <AccountPage title="My Orders">
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
    <AccountPage title="My Orders">
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

        {!ordersView ? (
          <>
            {/* CURRENT ORDER TRACKING */}
            <section className="surface rounded-2xl border p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-gold" />
                  <h2 className="text-base font-bold">
                    Current Order Tracking
                  </h2>
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        Order {currentOrder.order_reference || "Legacy order — no public reference"}
                  </p>
                      <button
                        type="button"
                        onClick={() => toggleDate(currentOrder.id)}
                        aria-label="Show order placement date and time"
                        aria-expanded={expandedDates.has(currentOrder.id)}
                        title="Show order date and time"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold transition hover:bg-gold/20"
                      >
                        <Clock3 className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {readItems(currentOrder.items).length} item line(s) ·{" "}
                      {money(Number(currentOrder.total))}
                    </p>
                  </div>

                  {expandedDates.has(currentOrder.id) && (
                    <p className="mt-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-foreground">
                      <Clock3 className="mr-1 inline h-3.5 w-3.5 text-gold" />
                      Placed on {dateTimeLabel(currentOrder.created_at)}
                    </p>
                  )}

                  {/* Five connected order stages */}
                  {(() => {
                    const status = currentOrder.status.toLowerCase();
                    const cancelled = isCancelledOrder(status);
                    const stage = trackingStage(status);

                    const cancelledLabel =
                      status === "returned"
                        ? "Returned"
                        : status === "refunded"
                          ? "Refunded"
                          : "Cancelled";

                    const steps = [
                      { label: "Ordered", icon: ShoppingBag },
                      {
                        label: cancelled ? cancelledLabel : "Approved",
                        icon: cancelled ? XCircle : CheckCircle2,
                      },
                      { label: "Processing", icon: PackageCheck },
                      { label: "Shipped", icon: Truck },
                      { label: "Delivered", icon: Home },
                    ];

                    return (
                      <div className="mt-7">
                        <div className="flex w-full items-start">
                          {steps.map((step, index) => {
                            const Icon = step.icon;
                            const complete = !cancelled && index <= stage;
                            const isCancelledNode = cancelled && index === 1;
                            const connectorComplete = cancelled
                              ? index === 0
                              : index < stage;

                            return (
                              <div
                                key={step.label}
                                className="relative flex min-w-0 flex-1 flex-col items-center"
                              >
                                {index < steps.length - 1 && (
                                  <span
                                    className={`absolute left-[calc(50%+1.15rem)] top-[1rem] h-0.5 w-[calc(100%-2.3rem)] ${
                                      connectorComplete
                                        ? cancelled && index === 0
                                          ? "bg-red-500"
                                          : "bg-gold"
                                        : "bg-border"
                                    }`}
                                  />
                                )}

                                <span
                                  className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border-2 ${
                                    isCancelledNode
                                      ? "border-red-500 bg-red-500/10 text-red-500"
                                      : complete
                                        ? "border-gold bg-gold/10 text-gold"
                                        : "border-border bg-muted/50 text-muted-foreground"
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </span>

                                <span
                                  className={`mt-2 text-center text-[9px] leading-tight sm:text-xs ${
                                    isCancelledNode
                                      ? "font-semibold text-red-500"
                                      : complete
                                        ? "font-semibold text-gold"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <p className="mt-5 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                    {currentOrder.status.toLowerCase() === "pending"
                      ? "Your order is waiting for merchant approval."
                      : currentOrder.status.toLowerCase() === "confirmed"
                        ? "Your order has been approved and is awaiting preparation."
                        : currentOrder.status.toLowerCase() === "processing"
                          ? "Your order is being prepared."
                          : currentOrder.status.toLowerCase() === "shipped"
                            ? "Your order has been marked as shipped. Live courier location updates are not yet connected."
                            : currentOrder.status.toLowerCase() === "delivered"
                              ? "Your order has been marked as delivered."
                              : isCancelledOrder(currentOrder.status)
                                ? "This order is closed and will not continue through the delivery stages."
                                : currentOrder.status.toLowerCase() === "paid"
                                  ? "Payment is marked as confirmed. Order fulfilment progress has not yet been confirmed."
                                  : "Your order status has been updated."}
                  </p>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(currentOrder.id);
                        setSummaryFilter("all");
                        setStatusFilter("all");
                        setSearchText("");
                        setOrdersView("all");
                      }}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline"
                    >
                      View order details <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex flex-col items-center rounded-xl bg-muted/40 px-4 py-7 text-center">
                  <Package className="h-9 w-9 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">No current order</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    When you place an order, its latest confirmed progress will
                    appear here.
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

            {/* ONLY FOUR CLICKABLE SUMMARY CARDS ON THE DASHBOARD */}
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: "Total orders",
                    value: orders.length,
                    icon: Package,
                    filter: "all" as OrderFilter,
                  },
                  {
                    label: "In progress",
                    value: inProgressCount,
                    icon: Clock3,
                    filter: "in_progress" as OrderFilter,
                  },
                  {
                    label: "Delivered",
                    value: deliveredCount,
                    icon: PackageCheck,
                    filter: "delivered" as OrderFilter,
                  },
                  {
                    label: "Awaiting approval",
                    value: awaitingCount,
                    icon: CheckCircle2,
                    filter: "awaiting_approval" as OrderFilter,
                  },
                ].map((stat) => {
                  const Icon = stat.icon;
                  const active = summaryFilter === stat.filter;

                  return (
                    <button
                      key={stat.label}
                      type="button"
                      onClick={() => selectSummary(stat.filter)}
                      aria-label={`Show ${stat.label.toLowerCase()} orders`}
                      aria-pressed={active}
                      className={`surface rounded-2xl border p-4 text-left transition hover:border-gold/60 hover:bg-gold/5 ${
                        active ? "border-gold bg-gold/5" : ""
                      }`}
                    >
                      <Icon className="h-5 w-5 text-gold" />
                      <p className="mt-3 text-2xl font-bold tabular-nums">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          /* SEPARATE IN-PAGE ORDERS VIEW */
          <section className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setOrdersView(null);
                setSelectedOrder(null);
                setSearchText("");
                setStatusFilter("all");
              }}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline"
            >
              <span aria-hidden="true">←</span> Back to My Orders
            </button>

            <div>
              <h2 className="text-lg font-bold">
                {summaryFilter === "all"
                  ? "All Orders"
                  : summaryFilter === "in_progress"
                    ? "Orders In Progress"
                    : summaryFilter === "delivered"
                      ? "Delivered Orders"
                      : "Awaiting Approval"}
              </h2>
            </div>

            <div className="surface space-y-3 rounded-2xl border p-4 sm:p-5">
              <p className="text-xs text-muted-foreground">
                {filteredOrders.length} order(s) found
              </p>

              {/* Search and refresh */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Find an order by number, product or status..."
                    className="field pl-10"
                  />
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

              {/* Status filters */}
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

              {filteredOrders.length === 0 ? (
                <div className="surface flex flex-col items-center rounded-2xl border px-5 py-10 text-center">
                  {orders.length === 0 ? (
                    <>
                      <Package className="h-10 w-10 text-muted-foreground" />
                      <h3 className="mt-3 font-semibold">No orders yet</h3>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Your orders will appear here when they are linked to
                        your customer account.
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
                      <h3 className="mt-3 font-semibold">
                        No matching orders
                      </h3>
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
                    const dateIsOpen = expandedDates.has(order.id);

                    return (
                      <article
                        key={order.id}
                        className="surface rounded-2xl border p-4 sm:p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                Order {selected.order_reference || "Legacy order — no public reference"}
                              </p>

                              <button
                                type="button"
                                onClick={() => toggleDate(order.id)}
                                aria-label="Show order placement date and time"
                                aria-expanded={dateIsOpen}
                                title="Show order date and time"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold transition hover:bg-gold/20"
                              >
                                <Clock3 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {dateIsOpen && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Placed on {dateTimeLabel(order.created_at)}
                              </p>
                            )}
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
                            <p className="font-bold">
                              {money(Number(order.total))}
                            </p>
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
            </div>

            {/* SELECTED ORDER DETAILS */}
            {selected && (
              <section
                className="surface scroll-mt-6 rounded-2xl border p-4 sm:p-5"
                aria-live="polite"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold">
                      Order {order.order_reference || "Legacy order — no public reference"}
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
                  <span className="text-sm text-muted-foreground">
                    Order status
                  </span>
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
                          Quantity: {item.quantity} · Unit price:{" "}
                          {money(item.price)}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold">
                        {money(item.total)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Subtotal</p>
                    <p className="font-semibold">
                      {money(Number(selected.subtotal))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Order total</p>
                    <p className="font-semibold">
                      {money(Number(selected.total))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      Payment status
                    </p>
                    <p className="font-semibold">
                      {paymentStatusText(selected.payment_status)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      Payment method
                    </p>
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
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {selected.notes}
                    </p>
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
          </section>
        )}
      </div>
    </AccountPage>
  );
}
