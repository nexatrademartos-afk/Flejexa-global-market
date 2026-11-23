
import { createFileRoute, Link } from "@tanstack/react-router";
import { useLocalList } from "@/lib/local-list";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  fetchStoreCatalogue,
  formatStorePrice,
  type StoreCatalogue,
} from "@/lib/preview-data";
import { EmptyState, PreviewNotice, SkeletonGrid } from "@/components/states";
import { ProductTile } from "@/components/ProductCard";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { buildCartWhatsAppMessage, openWhatsApp } from "@/lib/whatsapp";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_OPTIONS, isValidCountryIso2 } from "@/lib/countries";
import { WifiOff, CheckCircle2, Loader2, MapPin, ArrowLeft, ArrowRight } from "lucide-react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { useEffect, useRef, useState } from "react";

type ContactChannel = "whatsapp" | "sms" | "email";

type CheckoutStep = "cart" | "details" | "review" | "done";

type DeliveryAddress = {
  id: string;
  user_id: string;
  recipient: string;
  phone: string;
  street: string;
  city: string;
  province: string | null;
  postal_code: string | null;
  country_iso2: string | null;
  label: string | null;
  is_default: boolean;
};

type DeliveryForm = {
  recipient: string;
  phone: string;
  street: string;
  address_line2: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
  country_iso2: string;
};

type PaymentMethod = {
  code: string;
  label: string;
};

type CheckoutProfile = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_e164: string | null;
  phone_country_iso2: string | null;
  country_iso2: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  address_country_iso2: string | null;
phone_e164: string | null;
sms_contact_consent_at: string | null;
whatsapp_phone_e164: string | null;
whatsapp_verified_at: string | null;
whatsapp_contact_consent_at: string | null;
};

const EMPTY_DELIVERY: DeliveryForm = {
  recipient: "",
  phone: "",
  street: "",
  address_line2: "",
  suburb: "",
  city: "",
  province: "",
  postal_code: "",
  country_iso2: "ZA",
};

const CONTACT_OPTIONS: {
  value: ContactChannel;
  label: string;
  description: string;
}[] = [
  {
    value: "whatsapp",
    label: "WhatsApp",
    description: "Receive your delivery PIN on your verified WhatsApp number.",
  },
  {
    value: "sms",
    label: "SMS / Text message",
    description: "Receive your delivery PIN by SMS on your verified phone.",
  },
  {
    value: "email",
    label: "Email",
    description: "Receive your delivery PIN at your verified email address.",
  },
];

const checkoutRpc = supabase as unknown as {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

function makeRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function normalizePhone(value: string, country: string): string | null {
  if (!value.trim()) return null;

  try {
    const parsed = parsePhoneNumberFromString(
      value.trim(),
      country as CountryCode,
    );

    return parsed?.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}

function readPaymentMethods(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      item &&
      typeof item === "object" &&
      "code" in item &&
      "label" in item &&
      typeof item.code === "string" &&
      typeof item.label === "string"
    ) {
      return [{ code: item.code, label: item.label }];
    }

    return [];
  });
}

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export const Route = createFileRoute("/cart")({
  loader: () => fetchStoreCatalogue(),

  head: () => ({
    meta: [
      { title: brandPageTitle("Your cart") },
      {
        name: "description",
        content: `Review your ${BRAND.shortName} cart and complete checkout.`,
      },
      {
        property: "og:title",
        content: brandPageTitle("Cart"),
      },
      {
        property: "og:description",
        content: `Your ${BRAND.shortName} shopping cart.`,
      },
    ],
  }),

  component: CartPageComponent,
});

function CartPageComponent() {
  const catalogue = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <CartView catalogue={catalogue} />
    </div>
  );
}

export function CartView({ catalogue }: { catalogue?: StoreCatalogue }) {
  const cart = useLocalList("nexa-cart");
  const isOffline = !useOnlineStatus();

  const [step, setStep] = useState<CheckoutStep>("cart");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  const [profile, setProfile] = useState<CheckoutProfile | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const [delivery, setDelivery] = useState<DeliveryForm>(EMPTY_DELIVERY);
  const [phoneCountry, setPhoneCountry] = useState("ZA");

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");

const [deliveryChannels, setDeliveryChannels] = useState<ContactChannel[]>([]);

const [smsDestination, setSmsDestination] = useState("");
const [whatsappDestination, setWhatsappDestination] = useState("");
const [accountEmail, setAccountEmail] = useState("");
const [emailVerified, setEmailVerified] = useState(false);

const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [orderId, setOrderId] = useState("");

  const requestRef = useRef<{
    fingerprint: string;
    requestId: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCheckoutData() {
      setProfileLoading(true);
      setProfileError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          if (active) {
            setSignedIn(false);
            setProfileLoading(false);
          }
          return;
        }

        if (!active) return;

        setSignedIn(true);
        setAccountEmail(user.email || "");
setEmailVerified(Boolean(user.email_confirmed_at));

        const [profileResult, addressResult, paymentResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select(
                "full_name,first_name,last_name,phone,phone_e164,phone_country_iso2,country_iso2,address,address_line1,address_line2,suburb,city,province,postal_code,address_country_iso2,whatsapp_phone_e164,whatsapp_verified_at,whatsapp_contact_consent_at",
              )
              .eq("id", user.id)
              .maybeSingle(),

            supabase
              .from("customer_addresses")
              .select("*")
              .eq("user_id", user.id)
              .order("is_default", { ascending: false })
              .order("created_at", { ascending: false }),

            checkoutRpc.rpc("get_checkout_payment_methods"),
          ]);

        if (profileResult.error) throw profileResult.error;

        if (!active) return;

        const loadedProfile = profileResult.data as CheckoutProfile | null;
        setProfile(loadedProfile);
        setSmsDestination(loadedProfile?.phone_e164 || "");
setWhatsappDestination(
  loadedProfile?.whatsapp_phone_e164 || "",
);

        if (addressResult.error) {
          console.warn(
            "Unable to load saved delivery addresses:",
            addressResult.error.message,
          );
        }

        const addresses = (addressResult.data ?? []) as DeliveryAddress[];
        setSavedAddresses(addresses);

        const defaultAddress =
          addresses.find((address) => address.is_default) ?? addresses[0];

        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "";

        const profileName =
          loadedProfile?.full_name?.trim() ||
          [
            loadedProfile?.first_name,
            loadedProfile?.last_name,
          ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          metadataName;

        const profilePhone =
          loadedProfile?.phone_e164 ||
          loadedProfile?.phone ||
          user.phone ||
          "";

        const profileStreet =
          loadedProfile?.address_line1 ||
          loadedProfile?.address ||
          "";

        const profileCountry =
          loadedProfile?.address_country_iso2 ||
          loadedProfile?.country_iso2 ||
          "ZA";

        const initialDelivery: DeliveryForm = defaultAddress
          ? {
              recipient: defaultAddress.recipient,
              phone: defaultAddress.phone,
              street: defaultAddress.street,
              address_line2: "",
              suburb: "",
              city: defaultAddress.city,
              province: defaultAddress.province || "",
              postal_code: defaultAddress.postal_code || "",
              country_iso2: defaultAddress.country_iso2 || profileCountry,
            }
          : {
              recipient: profileName,
              phone: profilePhone,
              street: profileStreet,
              address_line2: loadedProfile?.address_line2 || "",
              suburb: loadedProfile?.suburb || "",
              city: loadedProfile?.city || "",
              province: loadedProfile?.province || "",
              postal_code: loadedProfile?.postal_code || "",
              country_iso2: profileCountry,
            };

        setDelivery(initialDelivery);
        setSelectedAddressId(defaultAddress?.id || "");

        const phoneCountryValue =
          loadedProfile?.phone_country_iso2 ||
          loadedProfile?.country_iso2 ||
          "ZA";

        setPhoneCountry(
          isValidCountryIso2(phoneCountryValue) ? phoneCountryValue : "ZA",
        );

        if (paymentResult.error) {
          throw paymentResult.error;
        }

        const methods = readPaymentMethods(paymentResult.data);
        setPaymentMethods(methods);

        setPaymentMethod((current) =>
          methods.some((method) => method.code === current)
            ? current
            : methods[0]?.code || "",
        );
      } catch (error) {
        if (active) {
          setProfileError(getErrorMessage(error));
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    }

    void loadCheckoutData();

    return () => {
      active = false;
    };
  }, []);

  if (!cart.ready || !catalogue) {
    return <SkeletonGrid count={2} />;
  }

  const items = cart.ids.flatMap((id) => {
    const product = catalogue.products.find((item) => item.id === id);

    if (!product) return [];

    return [
      {
        product,
        quantity: Math.max(1, cart.quantities[id] ?? 1),
      },
    ];
  });

  const missingCount = cart.ids.length - items.length;

  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const stockIssue = items.some(
    (item) => item.quantity > item.product.stock,
  );

  const normalizedSmsDestination = normalizePhone(
  smsDestination,
  phoneCountry,
);

const normalizedWhatsappDestination = normalizePhone(
  whatsappDestination,
  phoneCountry,
);

const smsEligible = Boolean(
  profile?.sms_contact_consent_at &&
    normalizedSmsDestination,
);

const whatsappEligible = Boolean(
  profile?.whatsapp_contact_consent_at &&
    normalizedWhatsappDestination,
);

const emailEligible = Boolean(
  accountEmail && emailVerified,
);
  function updateDelivery<K extends keyof DeliveryForm>(
    field: K,
    value: DeliveryForm[K],
  ) {
    setDelivery((current) => ({
      ...current,
      [field]: value,
    }));

    if (field === "phone") {
      setDeliveryChannels([]);
    }
  }

  function selectSavedAddress(address: DeliveryAddress) {
    setSelectedAddressId(address.id);

    setDelivery({
      recipient: address.recipient,
      phone: address.phone,
      street: address.street,
      address_line2: "",
      suburb: "",
      city: address.city,
      province: address.province || "",
      postal_code: address.postal_code || "",
      country_iso2: address.country_iso2 || "ZA",
    });

    setDeliveryChannels([]);
  }

  function toggleDeliveryChannel(channel: ContactChannel) {
    setDeliveryChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  function validateDelivery(): string | null {
    if (!delivery.recipient.trim()) {
      return "Please enter the recipient's name.";
    }

    if (!delivery.phone.trim()) {
      return "Please enter a delivery phone number.";
    }

    if (!delivery.street.trim()) {
      return "Please enter the street address.";
    }

    if (!delivery.city.trim()) {
      return "Please enter the city or town.";
    }

    if (
      delivery.country_iso2 &&
      !isValidCountryIso2(delivery.country_iso2)
    ) {
      return "Please select a valid delivery country.";
    }

    if (!paymentMethod) {
      return "There is currently no available payment method.";
    }

if (deliveryChannels.includes("whatsapp") && !whatsappEligible) {
  return "WhatsApp updates require a valid number and your WhatsApp contact consent.";
}

if (deliveryChannels.includes("sms") && !smsEligible) {
  return "SMS updates require a valid number and your SMS contact consent.";
}

if (deliveryChannels.includes("email") && !emailEligible) {
  return "Email updates require a verified account email address.";
}

    return null;
  }

  function orderOnWhatsApp() {
    const selectedChannels = [
      "In-app Delivery Centre",
      ...CONTACT_OPTIONS
        .filter((option) => deliveryChannels.includes(option.value))
        .map((option) => option.label),
    ];

    const message = [
      buildCartWhatsAppMessage(items),
      "",
      "DELIVERY PIN CONTACT PREFERENCES",
      ...selectedChannels.map((channel) => `- ${channel}`),
      "",
      "Please use my selected contact methods for delivery PIN notifications.",
    ].join("\n");

    openWhatsApp(message);
  }

  function goToDetails() {
    if (!signedIn) {
      setCheckoutError("Please sign in before placing an order.");
      return;
    }

    if (isOffline) {
      setCheckoutError(
        "You need an internet connection to complete secure checkout.",
      );
      return;
    }

    if (missingCount > 0) {
      setCheckoutError(
        "Some cart products are no longer available. Please review your cart.",
      );
      return;
    }

    if (stockIssue) {
      setCheckoutError(
        "One or more quantities exceed the available stock. Please update your cart.",
      );
      return;
    }

    if (items.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    setCheckoutError("");
    setStep("details");
  }

  function goToReview() {
    const validationError = validateDelivery();

    if (validationError) {
      setCheckoutError(validationError);
      return;
    }

    setCheckoutError("");
    setStep("review");
  }

  async function placeOrder() {
    if (submitting) return;

    if (!signedIn || isOffline) {
      setCheckoutError(
        "Please sign in and connect to the internet before placing your order.",
      );
      return;
    }

    const validationError = validateDelivery();

    if (validationError) {
      setCheckoutError(validationError);
      setStep("details");
      return;
    }

    if (missingCount > 0 || stockIssue || items.length === 0) {
      setCheckoutError(
        "Please review your cart. One or more products or quantities are unavailable.",
      );
      setStep("cart");
      return;
    }

    setSubmitting(true);
    setCheckoutError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Your session has expired. Please sign in again.");

      const deliveryPhone =
        deliveryChannels.length > 0 && normalizedDeliveryPhone
          ? normalizedDeliveryPhone
          : delivery.phone.trim();

      const addressPayload = {
  recipient: delivery.recipient.trim(),
  phone: delivery.phone.trim(),
  street: delivery.street.trim(),
  address_line2: delivery.address_line2.trim(),
  suburb: delivery.suburb.trim(),
  city: delivery.city.trim(),
  province: delivery.province.trim(),
  postal_code: delivery.postal_code.trim(),
  country_iso2: delivery.country_iso2.trim().toUpperCase(),

  sms_notification_phone: deliveryChannels.includes("sms")
    ? normalizedSmsDestination
    : null,

  whatsapp_notification_phone: deliveryChannels.includes("whatsapp")
    ? normalizedWhatsappDestination
    : null,
};

      const itemPayload = items.map(({ product, quantity }) => ({
        product_id: product.id,
        quantity,
      }));

      const requestPayload = {
        p_items: itemPayload,
        p_delivery_address: addressPayload,
        p_payment_method: paymentMethod,
        p_delivery_contact_channels: deliveryChannels,
        p_notes: notes.trim() || null,
      };

      const fingerprint = JSON.stringify(requestPayload);

      if (
        !requestRef.current ||
        requestRef.current.fingerprint !== fingerprint
      ) {
        requestRef.current = {
          fingerprint,
          requestId: makeRequestId(),
        };
      }

      const { data, error } = await checkoutRpc.rpc(
        "create_checkout_order",
        {
          p_request_id: requestRef.current.requestId,
          ...requestPayload,
        },
      );

      if (error) throw error;

      if (
        !data ||
        typeof data !== "object" ||
        !("order_id" in data) ||
        typeof data.order_id !== "string"
      ) {
        throw new Error(
          "The order response could not be verified. Please check My Orders before trying again.",
        );
      }

      setOrderId(data.order_id);

      // Clear only the cart after the server confirms order creation.
      localStorage.setItem("nexa-cart", "[]");
      localStorage.setItem("nexa-cart-quantities", "{}");
      window.dispatchEvent(new Event("nexa-list"));

      requestRef.current = null;
      setStep("done");
    } catch (error) {
      setCheckoutError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function StepIndicator() {
    const steps: { key: CheckoutStep; label: string }[] = [
      { key: "cart", label: "Cart" },
      { key: "details", label: "Details" },
      { key: "review", label: "Review" },
      { key: "done", label: "Done" },
    ];

    const currentIndex = steps.findIndex((item) => item.key === step);

    return (
      <div className="grid grid-cols-4 gap-2">
        {steps.map((item, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;

          return (
            <div key={item.key} className="space-y-2 text-center">
              <div
                className={`mx-auto grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${
                  complete || current
                    ? "border-gold bg-gold text-black"
                    : "border-border text-muted-foreground"
                }`}
              >
                {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <p
                className={`text-xs ${
                  current ? "font-bold text-gold" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  function ErrorMessage() {
    if (!checkoutError) return null;

    return (
      <div
        role="alert"
        className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
      >
        {checkoutError}
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="space-y-5">
        <StepIndicator />

        <section className="surface rounded-2xl border p-6 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />

          <h1 className="mt-4 text-2xl font-bold">
            Order received!
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Your order has been submitted successfully and is awaiting approval.
          </p>

          <div className="mt-5 rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">
              Your order reference
            </p>
            <p className="mt-1 break-all font-bold">
              #{orderId.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            You can follow your order progress from your customer account.
          </p>

          <Link
            to="/account/orders"
            className="btn btn-primary mt-5 inline-flex w-full items-center justify-center"
          >
            View My Orders
          </Link>

          <Link
            to="/shop"
            search={{ page: 1 }}
            className="mt-4 inline-flex text-sm font-semibold text-gold hover:underline"
          >
            Continue shopping
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Your Cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your FleJexa order securely.
        </p>
      </div>

      <StepIndicator />

      {step === "cart" && (
        <>
          <PreviewNotice>
            Review your products and quantities before continuing to delivery
            details.
          </PreviewNotice>

          {items.length === 0 ? (
            <EmptyState
              title="Your cart is empty"
              body="Browse the shop and add products you'd like to order."
              action={
                <Link
                  to="/shop"
                  search={{ page: 1 }}
                  className="btn btn-primary"
                >
                  Shop now
                </Link>
              }
            />
          ) : (
            <>
              <ul className="space-y-3">
                {items.map(({ product, quantity }) => (
                  <li
                    key={product.id}
                    className="surface flex items-center gap-3 rounded-xl border p-3"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                      <ProductTile p={product} className="h-16 w-16" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{product.name}</p>

                      <p className="text-sm text-muted-foreground">
                        {formatStorePrice(product.price)} each
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            cart.setQuantity(product.id, quantity - 1)
                          }
                          aria-label={`Decrease ${product.name} quantity`}
                          className="grid h-8 w-8 place-items-center rounded-md border hover:bg-muted"
                        >
                          −
                        </button>

                        <span className="min-w-5 text-center text-sm font-semibold">
                          {quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            cart.setQuantity(
                              product.id,
                              Math.min(quantity + 1, product.stock),
                            )
                          }
                          disabled={quantity >= product.stock}
                          aria-label={`Increase ${product.name} quantity`}
                          className="grid h-8 w-8 place-items-center rounded-md border hover:bg-muted disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm font-bold">
                        {formatStorePrice(product.price * quantity)}
                      </p>

                      <button
                        type="button"
                        onClick={() => cart.remove(product.id)}
                        className="text-xs font-medium text-destructive underline underline-offset-4"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {missingCount > 0 && (
                <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                  {missingCount} cart item(s) are no longer available in the
                  active catalogue. Remove those items before ordering.
                </p>
              )}

              {stockIssue && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  One or more quantities exceed current available stock.
                  Please adjust them before continuing.
                </p>
              )}

              <section className="surface space-y-4 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">Estimated item subtotal</span>
                  <span className="text-lg font-bold">
                    {formatStorePrice(total)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  Delivery charges will be confirmed separately. This is not a
                  final delivery-inclusive total.
                </p>

                <ErrorMessage />

                {profileLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking your customer account...
                  </div>
                ) : !signedIn ? (
                  <div className="rounded-lg border p-3 text-sm">
                    Please sign in to use secure in-app checkout.
                    <Link
                      to="/sign-in"
                      className="ml-2 font-semibold text-gold underline"
                    >
                      Sign in
                    </Link>
                  </div>
                ) : profileError ? (
                  <p className="text-sm text-red-500">
                    We could not load all checkout information: {profileError}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={goToDetails}
                  disabled={
                    profileLoading ||
                    !signedIn ||
                    isOffline ||
                    missingCount > 0 ||
                    stockIssue ||
                    items.length === 0
                  }
                  className="btn btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 disabled:opacity-50"
                >
                  Continue to Delivery Details
                  <ArrowRight className="h-4 w-4" />
                </button>

                {isOffline && (
                  <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-ink p-3 text-xs text-slate-200">
                    <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <p>
                      You are offline. Your cart is saved on this device, but
                      secure checkout requires an internet connection.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={orderOnWhatsApp}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-semibold hover:bg-muted"
                >
                  <WhatsAppIcon className="h-5 w-5" />
                  Continue enquiry on WhatsApp
                </button>
              </section>
            </>
          )}
        </>
      )}

      {step === "details" && (
        <section className="surface space-y-5 rounded-xl border p-4">
          <div>
            <h2 className="text-lg font-bold">Delivery details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your saved customer information is filled in automatically.
              You can edit it for this order.
            </p>
          </div>

          {profileError && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Some saved information could not be loaded. Please check the
              details below before continuing.
            </p>
          )}

          {savedAddresses.length > 0 && (
            <div>
              <label
                htmlFor="checkout_saved_address"
                className="mb-2 block text-sm font-semibold"
              >
                Choose a saved delivery address
              </label>

              <select
                id="checkout_saved_address"
                value={selectedAddressId}
                onChange={(event) => {
                  const address = savedAddresses.find(
                    (item) => item.id === event.target.value,
                  );

                  if (address) selectSavedAddress(address);
                  else setSelectedAddressId("");
                }}
                className="field"
              >
                <option value="">Use or enter another address</option>
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label || address.street}
                    {address.is_default ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="checkout_recipient" className="text-sm font-semibold">
                Recipient full name *
              </label>
              <input
                id="checkout_recipient"
                value={delivery.recipient}
                onChange={(event) =>
                  updateDelivery("recipient", event.target.value)
                }
                required
                maxLength={160}
                className="field mt-1"
                placeholder="Full name of the person receiving the order"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="checkout_phone" className="text-sm font-semibold">
                Delivery phone number *
              </label>
              <input
                id="checkout_phone"
                type="tel"
                value={delivery.phone}
                onChange={(event) =>
                  updateDelivery("phone", event.target.value)
                }
                required
                maxLength={40}
                className="field mt-1"
                placeholder="+27..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This is the number the delivery service will use to contact the
                recipient.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="checkout_street" className="text-sm font-semibold">
                Street address *
              </label>
              <input
                id="checkout_street"
                value={delivery.street}
                onChange={(event) =>
                  updateDelivery("street", event.target.value)
                }
                required
                maxLength={240}
                className="field mt-1"
                placeholder="Street name and number"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="checkout_address_line2"
                className="text-sm font-semibold"
              >
                Building, unit or complex
              </label>
              <input
                id="checkout_address_line2"
                value={delivery.address_line2}
                onChange={(event) =>
                  updateDelivery("address_line2", event.target.value)
                }
                className="field mt-1"
                placeholder="Optional"
              />
            </div>

            <div>
              <label htmlFor="checkout_suburb" className="text-sm font-semibold">
                Suburb
              </label>
              <input
                id="checkout_suburb"
                value={delivery.suburb}
                onChange={(event) =>
                  updateDelivery("suburb", event.target.value)
                }
                className="field mt-1"
              />
            </div>

            <div>
              <label htmlFor="checkout_city" className="text-sm font-semibold">
                City / Town *
              </label>
              <input
                id="checkout_city"
                value={delivery.city}
                onChange={(event) =>
                  updateDelivery("city", event.target.value)
                }
                required
                maxLength={120}
                className="field mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="checkout_province"
                className="text-sm font-semibold"
              >
                Province / State
              </label>
              <input
                id="checkout_province"
                value={delivery.province}
                onChange={(event) =>
                  updateDelivery("province", event.target.value)
                }
                className="field mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="checkout_postal"
                className="text-sm font-semibold"
              >
                Postal code
              </label>
              <input
                id="checkout_postal"
                value={delivery.postal_code}
                onChange={(event) =>
                  updateDelivery("postal_code", event.target.value)
                }
                className="field mt-1"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="checkout_country"
                className="text-sm font-semibold"
              >
                Country
              </label>
              <select
                id="checkout_country"
                value={delivery.country_iso2}
                onChange={(event) =>
                  updateDelivery("country_iso2", event.target.value)
                }
                className="field mt-1"
              >
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div>
              <h3 className="font-bold">Delivery PIN notifications</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Your in-app Delivery Centre is always included. Other channels
                are available only when the contact details are verified.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border p-3">
  <div>
    <h4 className="text-sm font-semibold">Notification destinations</h4>
    <p className="mt-1 text-xs text-muted-foreground">
      Your saved numbers are filled in automatically. You can change
      them for this order without changing your Profile.
    </p>
  </div>

  <div>
    <label
      htmlFor="checkout_sms_destination"
      className="text-sm font-semibold"
    >
      SMS number
    </label>
    <input
      id="checkout_sms_destination"
      type="tel"
      value={smsDestination}
      onChange={(event) => setSmsDestination(event.target.value)}
      className="field mt-1"
      placeholder="+27..."
    />
  </div>

  <div>
    <label
      htmlFor="checkout_whatsapp_destination"
      className="text-sm font-semibold"
    >
      WhatsApp number
    </label>
    <input
      id="checkout_whatsapp_destination"
      type="tel"
      value={whatsappDestination}
      onChange={(event) =>
        setWhatsappDestination(event.target.value)
      }
      className="field mt-1"
      placeholder="+27..."
    />
  </div>

  <div>
    <p className="text-sm font-semibold">Verified account email</p>
    <p className="mt-1 break-all text-sm text-muted-foreground">
      {accountEmail || "No account email available"}
    </p>
    <p className="mt-1 text-xs text-muted-foreground">
      {emailVerified ? "Email verified" : "Email not verified"}
    </p>
  </div>
</div>

            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <input type="checkbox" checked disabled className="mt-1 h-4 w-4" />
              <div>
                <p className="text-sm font-semibold">
                  In-app Delivery Centre
                  <span className="ml-2 text-xs text-emerald-600">
                    Always included
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Your delivery PIN will be available in your customer account.
                </p>
              </div>
            </div>

            {CONTACT_OPTIONS.map((option) => {
  const eligible =
    option.value === "whatsapp"
      ? whatsappEligible
      : option.value === "sms"
        ? smsEligible
        : emailEligible;

  return (
    <label
      key={option.value}
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        eligible
          ? "cursor-pointer hover:bg-muted/40"
          : "cursor-not-allowed opacity-50"
      }`}
    >
      <input
        type="checkbox"
        disabled={!eligible}
        checked={deliveryChannels.includes(option.value)}
        onChange={() => toggleDeliveryChannel(option.value)}
        className="mt-1 h-4 w-4"
      />
      <span>
        <span className="block text-sm font-semibold">
          {option.label}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {eligible
            ? option.description
            : "This option requires a valid contact detail and the required consent or verification."}
        </span>
      </span>
    </label>
  );
})}
          </div>

          <div>
            <label htmlFor="checkout_notes" className="text-sm font-semibold">
              Order notes (optional)
            </label>
            <textarea
              id="checkout_notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              rows={3}
              className="field mt-1"
              placeholder="Any useful delivery instructions?"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-bold">Payment method</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Only payment methods currently enabled and verified by FleJexa
              are shown here.
            </p>

            {paymentMethods.length === 0 ? (
              <p className="mt-3 rounded-lg border p-3 text-sm text-muted-foreground">
                No payment method is currently available. Please try again
                later.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {paymentMethods.map((method) => (
                  <label
                    key={method.code}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
                  >
                    <input
                      type="radio"
                      name="checkout_payment"
                      value={method.code}
                      checked={paymentMethod === method.code}
                      onChange={() => setPaymentMethod(method.code)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-semibold">
                      {method.label}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <ErrorMessage />

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setCheckoutError("");
                setStep("cart");
              }}
              className="btn inline-flex min-h-11 items-center justify-center gap-2 border"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Cart
            </button>

            <button
              type="button"
              onClick={goToReview}
              disabled={paymentMethods.length === 0}
              className="btn btn-primary inline-flex min-h-11 flex-1 items-center justify-center gap-2 disabled:opacity-50"
            >
              Review Order
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === "review" && (
        <section className="surface space-y-5 rounded-xl border p-4">
          <div>
            <h2 className="text-lg font-bold">Review your order</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Please check everything before placing your order.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Your products</h3>

            {items.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 border-b pb-3 text-sm"
              >
                <span className="min-w-0">
                  {product.name} × {quantity}
                </span>
                <span className="shrink-0 font-semibold">
                  {formatStorePrice(product.price * quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-muted/40 p-3">
            <div className="flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4 text-gold" />
              Delivery address
            </div>

            <p className="mt-3 text-sm font-semibold">
              {delivery.recipient}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
              {[
                delivery.phone,
                delivery.street,
                delivery.address_line2,
                delivery.suburb,
                delivery.city,
                delivery.province,
                delivery.postal_code,
                delivery.country_iso2,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>

            <button
              type="button"
              onClick={() => setStep("details")}
              className="mt-3 text-xs font-semibold text-gold underline"
            >
              Edit delivery details
            </button>
          </div>

          <div className="rounded-xl bg-muted/40 p-3">
  <h3 className="font-semibold">Delivery notifications</h3>

  <div className="mt-3 space-y-2 text-sm">
    <p>In-app Delivery Centre — Always included</p>

    {deliveryChannels.includes("whatsapp") && (
      <p>WhatsApp — {normalizedWhatsappDestination}</p>
    )}

    {deliveryChannels.includes("sms") && (
      <p>SMS — {normalizedSmsDestination}</p>
    )}

    {deliveryChannels.includes("email") && (
      <p>Email — {accountEmail}</p>
    )}

    {deliveryChannels.length === 0 && (
      <p className="text-muted-foreground">
        Only in-app Delivery Centre selected.
      </p>
    )}
  </div>

  <button
    type="button"
    onClick={() => setStep("details")}
    className="mt-3 text-xs font-semibold text-gold underline"
  >
    Edit notification preferences
  </button>
</div>
          
          <div className="rounded-xl bg-muted/40 p-3">
            <h3 className="font-semibold">Payment method</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {paymentMethods.find((method) => method.code === paymentMethod)
                ?.label || paymentMethod}
            </p>

            <button
              type="button"
              onClick={() => setStep("details")}
              className="mt-2 text-xs font-semibold text-gold underline"
            >
              Change payment method
            </button>
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Items subtotal</span>
              <span className="font-semibold">
                {formatStorePrice(total)}
              </span>
            </div>

            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Delivery fee</span>
              <span className="text-right text-xs text-muted-foreground">
                To be confirmed separately
              </span>
            </div>
          </div>

          {notes.trim() && (
            <div>
              <h3 className="text-sm font-semibold">Order notes</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {notes}
              </p>
            </div>
          )}

          <ErrorMessage />

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep("details")}
              disabled={submitting}
              className="btn inline-flex min-h-11 items-center justify-center gap-2 border"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              onClick={placeOrder}
              disabled={submitting || isOffline}
              className="btn btn-primary inline-flex min-h-11 flex-1 items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Placing order...
                </>
              ) : (
                "Place Order"
              )}
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Your order will be submitted for approval. Stock, prices and
            payment availability are checked again securely by FleJexa.
          </p>
        </section>
      )}
    </div>
  );
}
