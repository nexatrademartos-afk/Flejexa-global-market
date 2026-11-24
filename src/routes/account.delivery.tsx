import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";

type OrderRecord = {
  id: string;
  order_reference: string | null;
  created_at: string;
  status: string;
  total: number;
  items: unknown;
  customer_name: string;
  customer_address: string | null;
  customer_phone: string;
};

type DeliveryJob = {
  id: string;
  order_id: string;
  status: string;
  assigned_at: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  out_for_delivery_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type DeliveryConfirmation = {
  delivery_id: string;
  agreement_version: string | null;
  agreement_snapshot: string | null;
  customer_accepted_at: string | null;
  courier_confirmed_at: string | null;
  otp_verified_at: string | null;
  receipt_condition: string | null;
  customer_note: string | null;
};

type DeliveryEvent = {
  id: string;
  delivery_id: string;
  event_type: string;
  created_at: string;
  details: Record<string, unknown> | null;
};

type DeliveryAgreement = {
  version: string;
  title: string;
  body: string;
};

type DeliveryRecord = {
  job: DeliveryJob;
  order: OrderRecord;
  confirmation: DeliveryConfirmation | null;
  events: DeliveryEvent[];
};

type DeliveryPinState = {
  status:
    | "not_requested"
    | "active"
    | "expired"
    | "invalidated"
    | "verified"
    | "unavailable";
  expires_at: string | null;
  attempts_remaining: number;
  pin_code: string | null;
};

type ReceiptCondition = "good" | "damaged" | "incomplete" | "refused";

const db = supabase as any;

const money = (value: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const dateTime = (value: string | null | undefined) => {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const jobStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending_assignment: "Waiting for courier",
    assigned: "Courier assigned",
    accepted: "Courier accepted",
    picked_up: "Parcel collected",
    out_for_delivery: "Out for delivery",
    arrived: "Courier has arrived",
    completed: "Delivery completed",
    failed: "Delivery attempt failed",
    cancelled: "Delivery cancelled",
    disputed: "Delivery under review",
  };

  return labels[status] || status.replace(/_/g, " ");
};

const jobStatusStyle = (status: string) => {
  if (status === "completed") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }

  if (["failed", "cancelled", "disputed"].includes(status)) {
    return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
  }

  return "border-gold/40 bg-gold/10 text-gold";
};

const eventLabel = (event: string) => {
  const labels: Record<string, string> = {
    created: "Delivery record created",
    courier_assigned: "Courier assigned",
    courier_accepted: "Courier accepted the delivery",
    picked_up: "Parcel collected",
    out_for_delivery: "Parcel is out for delivery",
    arrived: "Courier arrived",
    otp_issued: "Receipt verification code requested",
    otp_verified: "Receipt verification completed",
    customer_accepted: "Customer confirmed receipt",
    completed: "Delivery completed",
    failed: "Delivery attempt failed",
    disputed: "Delivery issue reported",
    cancelled: "Delivery cancelled",
  };

  return labels[event] || event.replace(/_/g, " ");
};

const readItemNames = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 5).map((entry) => {
    const item =
      entry && typeof entry === "object"
        ? (entry as Record<string, unknown>)
        : {};

    return String(
      item.product_name ??
        item.productName ??
        item.name ??
        item.title ??
        item.product_title ??
        "Marketplace product",
    );
  });
};

const DELIVERY_STAGES = [
  { status: "assigned", label: "Assigned" },
  { status: "accepted", label: "Accepted" },
  { status: "picked_up", label: "Collected" },
  { status: "out_for_delivery", label: "On the way" },
  { status: "arrived", label: "Arrived" },
  { status: "completed", label: "Completed" },
];

export const Route = createFileRoute("/account/delivery")({
  head: accountHead(
    "Delivery Centre",
    "View delivery progress and securely confirm receipt of your FleJexa orders.",
  ),
  component: AccountDeliveryPage,
});

function AccountDeliveryPage() {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [deliveryPins, setDeliveryPins] = useState<
  Record<string, DeliveryPinState>
>({});
const [pinNow, setPinNow] = useState(Date.now());
  const [agreement, setAgreement] = useState<DeliveryAgreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [busyDelivery, setBusyDelivery] = useState<string | null>(null);

  const [codes, setCodes] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<
    Record<string, ReceiptCondition>
  >({});
  const [receiptNotes, setReceiptNotes] = useState<Record<string, string>>({});
  const [issueNotes, setIssueNotes] = useState<Record<string, string>>({});
  const [showIssueForm, setShowIssueForm] = useState<string | null>(null);

  const loadDeliveries = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");
    setActionError("");
    setActionSuccess("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setDeliveries([]);
        setError("Please sign in to view your deliveries.");
        return;
      }

      const { data: orderRows, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, order_reference, created_at, status, total, items, customer_name, customer_address, customer_phone",
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      const orders = (orderRows ?? []) as OrderRecord[];
      const orderIds = orders.map((order) => order.id);

      if (orderIds.length === 0) {
        setDeliveries([]);
        setAgreement(null);
        return;
      }

      const [
        { data: jobs, error: jobsError },
        { data: agreementRow, error: agreementError },
      ] = await Promise.all([
        db
          .from("delivery_jobs")
          .select(
            "id, order_id, status, assigned_at, accepted_at, picked_up_at, out_for_delivery_at, arrived_at, completed_at, failed_at, failure_reason, created_at, updated_at",
          )
          .in("order_id", orderIds)
          .order("created_at", { ascending: false }),

        db
          .from("delivery_agreements")
          .select("version, title, body")
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      if (jobsError) throw jobsError;
      if (agreementError) throw agreementError;

      const deliveryJobs = (jobs ?? []) as DeliveryJob[];
      const deliveryIds = deliveryJobs.map((job) => job.id);
      if (deliveryIds.length === 0) {
  setDeliveryPins({});
} else {
  const pinEntries = await Promise.all(
    deliveryJobs
      .filter((job) => job.status === "arrived")
      .map(async (job) => {
        try {
          const { data: statusData, error: statusError } = await db.rpc(
            "customer_delivery_pin_status",
            { p_delivery_id: job.id },
          );

          if (statusError) throw statusError;

          const statusRow = Array.isArray(statusData)
            ? statusData[0]
            : statusData;

          if (!statusRow) {
            return [
              job.id,
              {
                status: "unavailable",
                expires_at: null,
                attempts_remaining: 0,
                pin_code: null,
              } satisfies DeliveryPinState,
            ] as const;
          }

          let pinCode: string | null = null;

          if (statusRow.pin_status === "active") {
            const { data: pinData, error: pinError } = await db.rpc(
              "customer_get_delivery_pin",
              { p_delivery_id: job.id },
            );

            if (pinError) throw pinError;

            const pinRow = Array.isArray(pinData)
              ? pinData[0]
              : pinData;

            pinCode = pinRow?.pin_code ?? null;
          }

          return [
            job.id,
            {
              status: statusRow.pin_status,
              expires_at: statusRow.expires_at,
              attempts_remaining: statusRow.attempts_remaining,
              pin_code: pinCode,
            } satisfies DeliveryPinState,
          ] as const;
        } catch {
          return [
            job.id,
            {
              status: "unavailable",
              expires_at: null,
              attempts_remaining: 0,
              pin_code: null,
            } satisfies DeliveryPinState,
          ] as const;
        }
      }),
  );

  setDeliveryPins(Object.fromEntries(pinEntries));
      }

      setAgreement((agreementRow as DeliveryAgreement | null) ?? null);

      if (deliveryIds.length === 0) {
        setDeliveries([]);
        setDeliveryPins({});
        return;
      }

      const [
        { data: confirmations, error: confirmationError },
        { data: events, error: eventsError },
      ] = await Promise.all([
        db
          .from("delivery_confirmations")
          .select(
            "delivery_id, agreement_version, agreement_snapshot, customer_accepted_at, courier_confirmed_at, otp_verified_at, receipt_condition, customer_note",
          )
          .in("delivery_id", deliveryIds),

        db
          .from("delivery_events")
          .select("id, delivery_id, event_type, created_at, details")
          .in("delivery_id", deliveryIds)
          .order("created_at", { ascending: false })
          .limit(150),
      ]);

      if (confirmationError) throw confirmationError;
      if (eventsError) throw eventsError;

      const orderMap = new Map(orders.map((order) => [order.id, order]));
      const confirmationMap = new Map<string, DeliveryConfirmation>(
        ((confirmations ?? []) as DeliveryConfirmation[]).map((item) => [
          item.delivery_id,
          item,
        ]),
      );

      const eventRows = (events ?? []) as DeliveryEvent[];

      const records = deliveryJobs.flatMap((job) => {
        const order = orderMap.get(job.order_id);
        if (!order) return [];

        return [
          {
            job,
            order,
            confirmation: confirmationMap.get(job.id) ?? null,
            events: eventRows.filter((event) => event.delivery_id === job.id),
          },
        ];
      });

      setDeliveries(records);
    } catch (err) {
      setDeliveries([]);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't load your delivery information. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

useEffect(() => {
  const timer = window.setInterval(() => {
    setPinNow(Date.now());
  }, 1000);

  return () => window.clearInterval(timer);
}, []);
  
  const activeCount = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          !["completed", "cancelled"].includes(delivery.job.status),
      ).length,
    [deliveries],
  );

  const completedCount = useMemo(
    () =>
      deliveries.filter((delivery) => delivery.job.status === "completed")
        .length,
    [deliveries],
  );

  async function verifyReceiptCode(deliveryId: string) {
    const code = (codes[deliveryId] || "").trim();

    if (!/^\d{6}$/.test(code)) {
      setActionError("Enter the six-digit verification code.");
      return;
    }

    setBusyDelivery(deliveryId);
    setActionError("");
    setActionSuccess("");

    try {
      const { data, error: rpcError } = await db.rpc(
        "verify_delivery_email_otp",
        {
          p_delivery_id: deliveryId,
          p_code: code,
        },
      );

      if (rpcError) throw rpcError;

      if (data !== true) {
        throw new Error(
          "The code was not accepted. Check it and try again.",
        );
      }

      setActionSuccess(
        "Your verification code is confirmed. You can now record the parcel condition.",
      );

      await loadDeliveries(true);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Code verification failed.",
      );
    } finally {
      setBusyDelivery(null);
    }
  }

  async function acceptReceipt(deliveryId: string) {
    const condition = conditions[deliveryId] || "good";
    const note = (receiptNotes[deliveryId] || "").trim();

    setBusyDelivery(deliveryId);
    setActionError("");
    setActionSuccess("");

    try {
      const { data, error: rpcError } = await db.rpc(
        "accept_delivery_receipt",
        {
          p_delivery_id: deliveryId,
          p_receipt_condition: condition,
          p_customer_note: note || null,
        },
      );

      if (rpcError) throw rpcError;

      if (data === "disputed") {
        setActionSuccess(
          "Your parcel condition has been recorded as an issue. The delivery has not been marked as completed.",
        );
      } else {
        setActionSuccess(
          "Your receipt confirmation has been recorded. The courier must still confirm the handover.",
        );
      }

      await loadDeliveries(true);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Receipt confirmation failed.",
      );
    } finally {
      setBusyDelivery(null);
    }
  }

  async function reportIssue(deliveryId: string) {
    const reason = (issueNotes[deliveryId] || "").trim();

    if (reason.length < 3) {
      setActionError("Please explain the delivery issue.");
      return;
    }

    setBusyDelivery(deliveryId);
    setActionError("");
    setActionSuccess("");

    try {
      const { error: rpcError } = await db.rpc("open_delivery_dispute", {
        p_delivery_id: deliveryId,
        p_reason: reason,
      });

      if (rpcError) throw rpcError;

      setActionSuccess(
        "Your delivery issue has been recorded for review.",
      );
      setShowIssueForm(null);

      await loadDeliveries(true);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "We couldn't submit the issue.",
      );
    } finally {
      setBusyDelivery(null);
    }
  }

  if (loading) {
    return (
      <AccountPage title="Delivery Centre">
        <div className="surface flex items-center justify-center gap-3 rounded-2xl border p-12">
          <RefreshCw className="h-5 w-5 animate-spin text-gold" />
          <span className="text-sm text-muted-foreground">
            Loading your delivery information...
          </span>
        </div>
      </AccountPage>
    );
  }

  return (
    <AccountPage
      title="Delivery Centre"
      intro="Follow your delivery and securely confirm when your parcel arrives."
    >
      <div className="space-y-5">
        <section className="grid grid-cols-2 gap-3">
          <div className="surface rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4 text-gold" />
              <span className="text-xs font-medium">Active deliveries</span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {activeCount}
            </p>
          </div>

          <div className="surface rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium">Completed</span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {completedCount}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Your deliveries</h2>
            <p className="text-xs text-muted-foreground">
              Delivery progress is linked to your original orders.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadDeliveries(true)}
            disabled={refreshing}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold hover:border-gold/50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

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
                onClick={() => void loadDeliveries(true)}
                className="mt-2 font-semibold underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
          >
            {actionError}
          </p>
        )}

        {actionSuccess && (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
          >
            {actionSuccess}
          </p>
        )}

        {deliveries.length === 0 && !error && (
          <section className="surface rounded-2xl border border-dashed p-8 text-center">
            <Package className="mx-auto h-10 w-10 text-gold" />
            <h3 className="mt-3 font-bold">No delivery jobs yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              When one of your orders is approved for fulfilment, its delivery
              record will appear here automatically.
            </p>
            <Link
              to="/account/orders"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline"
            >
              View My Orders <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        {deliveries.map(({ job, order, confirmation, events }) => {
          const isArrived = job.status === "arrived";
          const isCompleted = job.status === "completed";
          const isDisputed = job.status === "disputed";
          const isVerified = Boolean(confirmation?.otp_verified_at);
          const isAccepted = Boolean(confirmation?.customer_accepted_at);
          const canReportIssue = ![
            "completed",
            "cancelled",
            "disputed",
          ].includes(job.status);

          const stageIndex = DELIVERY_STAGES.findIndex(
            (stage) => stage.status === job.status,
          );

          const itemNames = readItemNames(order.items);

          return (
            <article
              key={job.id}
              className="surface overflow-hidden rounded-2xl border"
            >
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Delivery reference
                    </p>
                    <h3 className="mt-1 break-all font-mono text-sm font-bold">
                      {job.id.slice(0, 8).toUpperCase()}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${jobStatusStyle(job.status)}`}
                  >
                    {jobStatusLabel(job.status)}
                  </span>
                </div>

                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Order total
                    </span>
                    <strong className="text-sm">{money(order.total)}</strong>
                  </div>

                  <div className="mt-2 space-y-1">
                    {itemNames.map((name, index) => (
                      <p
                        key={`${job.id}-item-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        {name}
                      </p>
                    ))}
                    {Array.isArray(order.items) && order.items.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        And {order.items.length - 5} more item(s)
                      </p>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Ordered {dateTime(order.created_at)}
                  </p>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold">Delivery progress</h4>
                    <span className="text-[11px] text-muted-foreground">
                      {jobStatusLabel(job.status)}
                    </span>
                  </div>

                  {["failed", "cancelled", "disputed"].includes(job.status) ? (
                    <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-muted-foreground">
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                      <span>
                        {job.failure_reason ||
                          (isDisputed
                            ? "This delivery is under review."
                            : "This delivery is not currently progressing.")}
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {DELIVERY_STAGES.map((stage, index) => {
                        const complete = isCompleted || index <= stageIndex;
                        const current = index === stageIndex;
                        const Icon =
                          index === 5
                            ? CheckCircle2
                            : index === 4
                              ? MapPin
                              : index === 3
                                ? Truck
                                : index === 2
                                  ? Package
                                  : index === 1
                                    ? CheckCircle2
                                    : Clock3;

                        return (
                          <div
                            key={stage.status}
                            className="flex min-w-0 flex-col items-center text-center"
                          >
                            <span
                              className={`grid h-8 w-8 place-items-center rounded-full border ${
                                complete
                                  ? "border-gold bg-gold/10 text-gold"
                                  : "border-border text-muted-foreground"
                              } ${current ? "ring-2 ring-gold/30" : ""}`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span
                              className={`mt-1.5 text-[9px] leading-tight sm:text-[10px] ${
                                complete
                                  ? "font-semibold text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {stage.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {order.customer_address && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <span>{order.customer_address}</span>
                  </div>
                )}

                {isArrived && !isAccepted && (
                  <section className="space-y-3 rounded-xl border border-gold/40 bg-gold/5 p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-gold" />
                      <h4 className="text-sm font-bold">
                        Confirm your parcel receipt
                      </h4>
                    </div>

                    <p className="text-xs leading-5 text-muted-foreground">
                      Before confirming receipt, verify the one-time code
                      supplied to your verified email address. The code
                      sending service is still being connected. This page
                      will not claim a code has been sent.
                    </p>

                    {!isVerified ? (
                      <div className="space-y-2">
                        <label
                          htmlFor={`delivery-code-${job.id}`}
                          className="text-xs font-semibold"
                        >
                          Six-digit verification code
                        </label>
                        <input
                          id={`delivery-code-${job.id}`}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={codes[job.id] || ""}
                          onChange={(event) =>
                            setCodes((previous) => ({
                              ...previous,
                              [job.id]: event.target.value
                                .replace(/\D/g, "")
                                .slice(0, 6),
                            }))
                          }
                          placeholder="Enter your code"
                          className="field"
                        />
                        <button
                          type="button"
                          onClick={() => void verifyReceiptCode(job.id)}
                          disabled={busyDelivery === job.id}
                          className="btn btn-primary w-full"
                        >
                          {busyDelivery === job.id
                            ? "Verifying..."
                            : "Verify receipt code"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Verification successful
                        </p>

                        <div>
                          <label
                            htmlFor={`condition-${job.id}`}
                            className="text-xs font-semibold"
                          >
                            Parcel condition
                          </label>
                          <select
                            id={`condition-${job.id}`}
                            value={conditions[job.id] || "good"}
                            onChange={(event) =>
                              setConditions((previous) => ({
                                ...previous,
                                [job.id]: event.target.value as ReceiptCondition,
                              }))
                            }
                            className="field mt-1"
                          >
                            <option value="good">Received in good condition</option>
                            <option value="damaged">Parcel is damaged</option>
                            <option value="incomplete">Items are missing</option>
                            <option value="refused">I refused the parcel</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`receipt-note-${job.id}`}
                            className="text-xs font-semibold"
                          >
                            Additional note (optional)
                          </label>
                          <textarea
                            id={`receipt-note-${job.id}`}
                            value={receiptNotes[job.id] || ""}
                            onChange={(event) =>
                              setReceiptNotes((previous) => ({
                                ...previous,
                                [job.id]: event.target.value.slice(0, 1000),
                              }))
                            }
                            rows={3}
                            maxLength={1000}
                            placeholder="Add details about the parcel..."
                            className="field mt-1"
                          />
                        </div>

                        <p className="rounded-lg bg-background/70 p-3 text-xs leading-5 text-muted-foreground">
                          <FileText className="mr-1 inline h-4 w-4 text-gold" />
                          {agreement?.title || "Delivery receipt agreement"}
                          {agreement && (
                            <>
                              {" "}
                              · Version {agreement.version}
                              <span className="mt-2 block">
                                {agreement.body}
                              </span>
                            </>
                          )}
                        </p>

                        <button
                          type="button"
                          onClick={() => void acceptReceipt(job.id)}
                          disabled={busyDelivery === job.id || !agreement}
                          className="btn btn-primary w-full"
                        >
                          {busyDelivery === job.id
                            ? "Saving confirmation..."
                            : "Accept agreement and confirm receipt"}
                        </button>

                        {!agreement && (
                          <p className="text-xs text-red-500">
                            The active delivery agreement could not be loaded.
                            Please contact support.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {isAccepted && !isCompleted && !isDisputed && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Your receipt confirmation is recorded.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Waiting for the assigned courier to confirm the handover.
                      Your order will only become Delivered after both
                      confirmations are validated.
                    </p>
                  </div>
                )}

                {isCompleted && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Delivery completed
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Both receipt confirmations were recorded. Your original
                      order has been marked as Delivered.
                    </p>
                  </div>
                )}

                {canReportIssue && (
                  <div className="border-t pt-3">
                    {!showIssueForm || showIssueForm !== job.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError("");
                          setShowIssueForm(job.id);
                        }}
                        className="text-xs font-semibold text-red-500 hover:underline"
                      >
                        Report a delivery problem
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <label
                          htmlFor={`issue-${job.id}`}
                          className="text-xs font-semibold"
                        >
                          Describe the delivery problem
                        </label>
                        <textarea
                          id={`issue-${job.id}`}
                          rows={3}
                          maxLength={1000}
                          value={issueNotes[job.id] || ""}
                          onChange={(event) =>
                            setIssueNotes((previous) => ({
                              ...previous,
                              [job.id]: event.target.value.slice(0, 1000),
                            }))
                          }
                          placeholder="Tell us what happened..."
                          className="field"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void reportIssue(job.id)}
                            disabled={busyDelivery === job.id}
                            className="btn btn-primary"
                          >
                            {busyDelivery === job.id
                              ? "Submitting..."
                              : "Submit issue"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowIssueForm(null)}
                            className="btn btn-outline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {events.length > 0 && (
                  <details className="border-t pt-3">
                    <summary className="cursor-pointer text-xs font-semibold">
                      Delivery activity ({events.length})
                    </summary>
                    <ol className="mt-3 space-y-3">
                      {events.map((event) => (
                        <li
                          key={event.id}
                          className="flex items-start gap-3 text-xs"
                        >
                          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
                          <div className="min-w-0">
                            <p className="font-medium">
                              {eventLabel(event.event_type)}
                            </p>
                            <p className="mt-0.5 text-muted-foreground">
                              {dateTime(event.created_at)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}

                <div className="flex justify-end border-t pt-3">
                  <Link
                    to="/account/orders"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
                  >
                    View original order <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </AccountPage>
  );
}
