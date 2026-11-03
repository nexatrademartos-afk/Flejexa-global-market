import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bot,
  Send,
  X,
  RotateCcw,
  Loader2,
  Sparkles,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { useLocalList } from "@/lib/local-list";
import { fetchStoreCatalogue, type StoreProduct } from "@/lib/preview-data";
import {
  buildCartWhatsAppMessage,
  NEXA_QUICK_MESSAGE,
  openWhatsApp,
} from "@/lib/Whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { sendAiChatMessage } from "@/lib/ai/server";
import type { ChatMessage as AiChatMessage } from "@/lib/ai/types";

export interface ChatAction {
  type: "whatsapp" | "support_escalate" | "link" | "case_step";
  label: string;
  payload?: string;
}

export interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  actions?: ChatAction[];
  action?: {
    type: "whatsapp" | "faq" | "retry";
    label: string;
  };
}


export interface SupportCategory {
  id: string;
  label: string;
  priority: "HIGH" | "NORMAL";
  description: string;
}

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  { id: "fraud", label: "🚨 Fraud / Security", priority: "HIGH", description: "Suspicious activity or compromised accounts" },
  { id: "payment", label: "💳 Payment Issue", priority: "NORMAL", description: "Payment confirmation or processing queries" },
  { id: "order", label: "📦 Order & Delivery", priority: "NORMAL", description: "Order status or delivery coordination" },
  { id: "wallet", label: "👛 Account & Wallet", priority: "NORMAL", description: "Wallet access or PIN assistance" },
  { id: "product", label: "🛍️ Product & Shopping", priority: "NORMAL", description: "Product availability or specifications" },
  { id: "complaint", label: "📝 General Complaint", priority: "NORMAL", description: "Customer experience or service feedback" },
  { id: "other", label: "❓ Other Enquiry", priority: "NORMAL", description: "General marketplace questions" },
];

export function checkContainsSecrets(text: string): boolean {
  if (/\b(password|passcode)\b/i.test(text)) return true;
  if (/\b(pin|cvv|otp)\b.*\b\d{3,6}\b/i.test(text)) return true;
  if (/\b\d{3,6}\b.*\b(pin|cvv|otp)\b/i.test(text)) return true;
  if (/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/.test(text)) return true;
  return false;
}

export function isCaseInitiationQuery(query: string): boolean {
  return /\b(open\s+(?:an?\s+)?(?:[a-z]+\s+)?(?:case|ticket)|submit\s+(?:an?\s+)?(?:[a-z]+\s+)?(?:ticket|case)|report\s+(?:an?\s+)?(?:[a-z]+\s+)?(?:issue|problem|fraud|incident)|log\s+(?:an?\s+)?(?:[a-z]+\s+)?ticket|create\s+(?:an?\s+)?(?:[a-z]+\s+)?ticket|file\s+(?:an?\s+)?(?:[a-z]+\s+)?complaint)\b/i.test(query.trim());
}

export function parseSupportContact(text: string): { name: string; email: string | null; phone: string | null } {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : null;

  const phoneMatch = text.match(/(?:\+?27|0)\s*\d{2}\s*\d{3}\s*\d{4}/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : null;

  let cleaned = text;
  if (email) cleaned = cleaned.replace(email, "");
  if (phoneMatch) cleaned = cleaned.replace(phoneMatch[0], "");
  cleaned = cleaned.replace(/[,;:\n\r]+/g, " ").trim();
  const name = cleaned.length > 1 ? cleaned : "Customer";

  return { name, email, phone };
}

export interface GuidedCaseState {
  step: "idle" | "category" | "description" | "contact" | "orderRef" | "submitting";
  category?: string;
  isUrgent?: boolean;
  description?: string;
  name?: string;
  email?: string;
  phone?: string;
}

const WHATSAPP_SUPPORT_MESSAGE =
  "Hello, I need help from customer support. Please assist me.";

export function cleanAiResponseText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[blank\]/gi, "")
    .replace(/(?:on|via)\s+WhatsApp\s+(?:at|via|on)\s+https?:\/\/wa\.me\/\S+/gi, "on WhatsApp")
    .replace(/WhatsApp\s+(?:at|via|on)\s+https?:\/\/wa\.me\/\S+/gi, "WhatsApp")
    .replace(/at\s+https?:\/\/wa\.me\/\S+/gi, "on WhatsApp")
    .replace(/https?:\/\/wa\.me\/\S+/gi, "")
    .replace(/\s+at\s+([.,!?;]|$)/gi, "$1")
    .replace(/\s+at\s+(for|to|with)\b/gi, " $1")
    .replace(/WhatsApp\s*:\s*$/i, "WhatsApp")
    .replace(/\b(?:at|via|on|contact)\s*:\s*$/i, ".")
    .replace(/\b(?:at|via|on)\s*$/i, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function getDeterministicLocalResponse(
  queryText: string,
  products: StoreProduct[] = [],
): { text: string; actions?: ChatAction[] } | null {
  const query = queryText.trim().toLowerCase();
  if (!query) return null;

  
  // Professional business greeting for the storefront assistant.
  if (
    /^\s*(hi|hello|hey|good\s+(morning|afternoon|evening|day)|greetings|howdy|how\s+are\s+you|what'?s\s+up)\b/i.test(query)
  ) {
    return {
      text: `Welcome to ${BRAND.name}. I’m TJC-OS, your virtual shopping assistant. I can help you explore our products, choose what suits your needs, and get assistance with your order. What would you like to shop for today?`,
      actions: [
        { type: "link", label: "Browse Products", payload: "/shop" },
        {
          type: "whatsapp",
          label: "Contact Support",
          payload: "Hello, I need assistance with shopping at ${BRAND.name}.",
        },
      ],
    };
  }

    // Missing-order reports should not depend on the AI provider.
  if (/\b(didn.t receive|haven.t received|never received|missing (?:my )?(?:order|parcel|delivery)|order (?:hasn.t|has not) arrived|my order (?:is )?late)\b/i.test(query)) {
    return {
      text: `I understand how concerning a missing delivery is. Live courier tracking is not connected to this chat, so I can’t look up delivery records directly. If you have an order reference, share it with support so they can check the available order information. You can also open a support ticket.`,
      actions: [
        {
          type: "whatsapp",
          label: "Chat on WhatsApp",
          payload: "Hello, I haven’t received my order. Please help me check it.",
        },
        {
          type: "case_step",
          label: "Open Support Ticket",
          payload: "I want to open a support ticket",
        },
      ],
    };
  }
  
  // Registration and sign-in use the existing authentication routes.
  if (/\b(?:how.*(?:set|create|open|register).*account|create.*account|set.*account|register.*account|sign\s*up|sign\s*in|log\s*in|login|forgot.*password|reset.*password)\b/i.test(query)) {
    return {
      text: `To create an account, visit /sign-up and enter your name, email, and a password of at least 8 characters. If you already registered, use /sign-in. For a forgotten password, use /forgot-password.`,
      actions: [
        { type: "link", label: "Create Account", payload: "/sign-up" },
        { type: "link", label: "Sign In", payload: "/sign-in" },
        { type: "link", label: "Reset Password", payload: "/forgot-password" },
      ],
    };
  }

  // No live weather provider is configured for this assistant.
  if (/\b(weather|temperature|forecast|rain|sunny)\b/i.test(query)) {
    return {
      text: `I don’t have live weather data. I can help with ${BRAND.name} products, shopping, accounts, and customer support.`,
      actions: [{ type: "link", label: "Browse Products", payload: "/shop" }],
    };
  }

  // 2. Fraud & Security (calm, explicit safeguards, no secrets, bank escalation)
  if (/\b(fraud|scam|suspicious|hacked|unauthorized|stolen|compromised|bank\s+card)\b/i.test(query)) {
    return {
      text: `Security Alert: We take customer security seriously. Never disclose your wallet PIN, account passwords, or one-time verification codes (OTPs) to anyone. If you suspect your bank card or account has been compromised, please contact your bank immediately.

You can also report urgent security concerns directly to our support team on WhatsApp.`,
      actions: [
        {
          type: "whatsapp",
          label: "Report Security Concern",
          payload: "URGENT: I need to report a security/fraud concern.",
        },
      ],
    };
  }

  // 3. Human agent & Support escalation (clickable action instead of raw URLs)
  if (/\b(speak\s+to\s+(an?\s+)?(agent|human|person|someone)|human\s+agent|talk\s+to\s+(someone|a\s+human|an\s+agent)|customer\s+(care|support|service)|support\s+team|live\s+agent|real\s+person|contact\s+support|help\s+desk)\b/i.test(query)) {
    return {
      text: `I'm happy to connect you directly with our customer support team. Our team is available on WhatsApp to assist you with order enquiries, custom product quotes, and account assistance.`,
      actions: [
        {
          type: "whatsapp",
          label: "Chat on WhatsApp",
          payload: WHATSAPP_SUPPORT_MESSAGE,
        },
      ],
    };
  }

  // 4. Delivery & Shipping
  if (/\b(delivery|shipping|courier|how\s+long.*deliver|deliver.*south\s+africa|delivery\s+times?)\b/i.test(query)) {
    return {
      text: `Delivery options and fees depend on your area and are confirmed by the team when arranging an order. Please share your town or suburb with support to check what is available.`,
      actions: [
        {
          type: "whatsapp",
          label: "Enquire About Delivery",
          payload: "Hello, I would like to check delivery options for my area.",
        },
      ],
    };
  }

  // 5. How to order / WhatsApp ordering
  if (/\b(how.*(order|buy|purchase)|order.*whatsapp|place.*order|buy.*product)\b/i.test(query)) {
    return {
      text: `You can place orders directly via WhatsApp with our team! Browse our catalogue, choose the items you'd like, and send us a message. We will confirm stock availability, delivery fees, and final payment details. Website checkout is currently in preview mode.`,
      actions: [
        {
          type: "whatsapp",
          label: "Order via WhatsApp",
          payload: "Hello, I would like to place an order.",
        },
      ],
    };
  }

  // 6. Returns & refunds
  if (/\b(return|refund|exchange|cancel.*order|returns?\s+policy)\b/i.test(query)) {
    return {
      text: `For returns, refunds, or exchanges, please contact our support team with your order details. All requests are handled directly by our team in accordance with store policy.`,
      actions: [
        {
          type: "whatsapp",
          label: "Returns Support",
          payload: "Hello, I would like to enquire about returns and refunds.",
        },
      ],
    };
  }

  // 7. Order tracking / status
  if (/\b(track|tracking|where.*order|order\s+status|order\s+reference|parcel\s+status)\b/i.test(query)) {
    return {
      text: `Live automated order tracking is not yet connected to this chat. To check the status of your order, please message our support team on WhatsApp and share your order reference if you have one.`,
      actions: [
        {
          type: "whatsapp",
          label: "Track via WhatsApp",
          payload: "Hello, I'd like to check the status of my order.",
        },
      ],
    };
  }

  // 8. Wallet & PIN facts
  if (/\b(wallet|pin|q\s+points|commissions|promo\s+credit|deposit|withdraw|balance)\b/i.test(query)) {
    return {
      text: `If your account has a wallet, open Account → Wallet and follow the on-screen setup to set a private six-digit PIN. The wallet uses South African Rand (ZAR). Cash, Q Points, commissions, and promotional credits are separate. Deposits, transfers, and withdrawals are currently disabled pending provider activation. Never disclose your wallet PIN, password, or verification code.`,
      actions: [
        {
          type: "link",
          label: "Open Wallet",
          payload: "/account/wallet",
        },
        {
          type: "whatsapp",
          label: "Ask Support About Wallet",
          payload: "Hello, I have a question regarding the wallet preview.",
        },
      ],
    };
  }

  // 9. Specific catalogue product match
  const matchedProduct = products.find((product) => {
    const productName = product.name?.trim().toLowerCase();
    return Boolean(productName && productName.length > 2 && query.includes(productName));
  });

  if (matchedProduct) {
    return {
      text: `The catalogue lists ${matchedProduct.name} at R${matchedProduct.price}. Note that catalogue snapshots may not reflect current stock or final pricing. Please check the product listing or enquire with our team on WhatsApp for confirmation.`,
      actions: [
        {
          type: "whatsapp",
          label: `Enquire About ${matchedProduct.name}`,
          payload: `Hello, I'd like to enquire about ${matchedProduct.name}.`,
        },
      ],
    };
  }

  return null;
}

function getWelcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    sender: "ai",
    text: `Hello! Welcome to ${BRAND.name}. I'm TJC-OS, your 24/7 AI assistant. How can I help you today?`,
  };
}

export function FloatingSupportButtons() {
  const cart = useLocalList("nexa-cart");
  const navigate = useNavigate();

  const pathname = useLocation({
    select: (location) => location.pathname,
  });

  const pageMode = pathname === "/ai-assistant";

  const [menuOpen, setMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [products, setProducts] = useState<
    Awaited<ReturnType<typeof fetchStoreCatalogue>>["products"]
  >([]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    getWelcomeMessage(),
  ]);

    const [caseState, setCaseState] = useState<GuidedCaseState>({ step: "idle" });
  const caseStateRef = useRef<GuidedCaseState>({ step: "idle" });
const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const requestInFlightRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    fetchStoreCatalogue()
      .then((data) => {
        if (active) {
          setProducts(data.products || []);
        }
      })
      .catch((error) => {
        console.warn("Unable to load catalogue context:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (aiOpen || pageMode) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, aiOpen, isThinking, pageMode]);

  async function handleSend(customText?: string) {
    const query = (customText ?? input).trim();

    if (!query || isThinking || requestInFlightRef.current) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      sender: "user",
      text: query,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    if (customText === undefined) {
      setInput("");
    }

    // Check guided support case flow
    const currentStep = caseStateRef.current.step;

    if (query.toLowerCase() === "cancel" && currentStep !== "idle") {
      caseStateRef.current = { step: "idle" };
      setCaseState({ step: "idle" });
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          sender: "ai",
          text: "Support ticket process cancelled. How else can I help you today?",
        },
      ]);
      return;
    }

    if (currentStep === "idle" && isCaseInitiationQuery(query)) {
      caseStateRef.current = { step: "category" };
      setCaseState({ step: "category" });
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          sender: "ai",
          text: `I can help you open an official support case for our customer care team. Please select the category that best describes your enquiry below:\n*(Type "cancel" at any time to exit)*`,
          actions: SUPPORT_CATEGORIES.map((cat) => ({
            type: "case_step",
            label: cat.label,
            payload: cat.id,
          })),
        },
      ]);
      return;
    }

    if (currentStep === "category") {
      const selected = SUPPORT_CATEGORIES.find(
        (c) =>
          c.id.toLowerCase() === query.toLowerCase() ||
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          query.toLowerCase().includes(c.id.toLowerCase())
      );

      if (!selected) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            sender: "ai",
            text: "Please select one of the categories below to proceed, or type \"cancel\" to exit:",
            actions: SUPPORT_CATEGORIES.map((cat) => ({
              type: "case_step",
              label: cat.label,
              payload: cat.id,
            })),
          },
        ]);
        return;
      }

      const nextState: GuidedCaseState = {
        step: "description",
        category: selected.label,
        isUrgent: selected.priority === "HIGH",
      };
      caseStateRef.current = nextState;
      setCaseState(nextState);

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          sender: "ai",
          text: `Selected Category: **${selected.label}** ${selected.priority === "HIGH" ? "(High Priority)" : ""}\n\nPlease describe your enquiry or what happened in detail.\n\n⚠️ **Security Notice:** Never include passwords, your 6-digit wallet PIN, OTP codes, or bank card numbers.`,
        },
      ]);
      return;
    }

    if (currentStep === "description") {
      if (checkContainsSecrets(query)) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            sender: "ai",
            text: `⚠️ **Security Alert:** Your message appears to contain sensitive information (such as a PIN, password, OTP, or card number). Please describe your issue without including any secret credentials.`,
          },
        ]);
        return;
      }

      const nextState: GuidedCaseState = {
        ...caseStateRef.current,
        step: "contact",
        description: query,
      };
      caseStateRef.current = nextState;
      setCaseState(nextState);

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          sender: "ai",
          text: `Thank you. Please enter your contact details so our support team can follow up:\n\nFormat: **Full Name, Email address, South African Phone number**\n*(e.g. Sipho Dlamini, sipho@example.co.za, 0712345678)*`,
        },
      ]);
      return;
    }

    if (currentStep === "contact") {
      const contact = parseSupportContact(query);
      if (!contact.email) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            sender: "ai",
            text: `Please provide at least a valid email address so our team can follow up with your ticket (e.g. yourname@example.com).`,
          },
        ]);
        return;
      }

      const nextState: GuidedCaseState = {
        ...caseStateRef.current,
        step: "orderRef",
        name: contact.name,
        email: contact.email,
        phone: contact.phone || undefined,
      };
      caseStateRef.current = nextState;
      setCaseState(nextState);

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          sender: "ai",
          text: `Contact details saved: **${contact.name}** (${contact.email}).\n\nDo you have a related **Order Reference**? If not, select or type **None**.`,
          actions: [
            {
              type: "case_step",
              label: "None",
              payload: "None",
            },
          ],
        },
      ]);
      return;
    }

    if (currentStep === "orderRef") {
      const orderRef = /^(none|no|n\/a|nil)$/i.test(query.trim()) ? null : query.trim();
      const state = { ...caseStateRef.current };
      const refCode = "CASE-" + Date.now().toString(36).toUpperCase().slice(-4) + Math.random().toString(36).substring(2, 6).toUpperCase();

      setIsThinking(true);
      try {
        const { error } = await supabase.from("contact_messages").insert({
          name: state.name || "Customer",
          email: state.email!,
          phone: state.phone || null,
          subject: `[${refCode}] [${state.category}] Support Case`,
          message: [
            `Case Reference: ${refCode}`,
            `Category: ${state.category}`,
            `Priority: ${state.isUrgent ? "HIGH" : "NORMAL"}`,
            `Order Reference: ${orderRef || "N/A"}`,
            "",
            "Customer Description:",
            state.description || "No description provided",
            "",
            "---",
            "Submitted via TJC-OS Guided Support",
          ].join("\n"),
        });

        if (error) {
          // Keep the customer's collected details so they can retry without re-entering them.
          caseStateRef.current = { ...state, step: "orderRef" };
          setCaseState({ ...state, step: "orderRef" });
          console.warn("Support case database insert failed");
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-assistant`,
              sender: "ai",
              text: `I couldn't record your ticket in our database right now due to a network or server error. To ensure your request is not lost, please message our support team on WhatsApp using the button below with your details.`,
              actions: [
                {
                  type: "whatsapp",
                  label: "Send Ticket on WhatsApp",
                  payload: `Support Ticket: ${state.category}\nRef: ${refCode}\nContact: ${state.name} (${state.email})\nDescription: ${state.description}`,
                },
              ],
            },
          ]);
        } else {
          caseStateRef.current = { step: "idle" };
          setCaseState({ step: "idle" });
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-assistant`,
              sender: "ai",
              text: `✅ **Support Case Registered Successfully**\n\n• **Case Reference:** \`${refCode}\`\n• **Category:** ${state.category} ${state.isUrgent ? "(High Priority)" : ""}\n• **Contact:** ${state.name} (${state.email})\n\nOur customer support team has received your ticket in the queue. If you would like to follow up directly or share screenshots, you can continue on WhatsApp using your case reference below.`,
              actions: [
                {
                  type: "whatsapp",
                  label: `Chat on WhatsApp regarding ${refCode}`,
                  payload: `Hello support, I have logged support case ${refCode} (${state.category}). Please assist.`,
                },
              ],
            },
          ]);
        }
      } catch (err) {
        console.warn("Support case exception:", err);
        caseStateRef.current = { step: "idle" };
        setCaseState({ step: "idle" });
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            sender: "ai",
            text: `An unexpected error occurred while saving your case. Please contact our support team directly on WhatsApp so we can assist you.`,
            actions: [
              {
                type: "whatsapp",
                label: "Chat with Support",
                payload: WHATSAPP_SUPPORT_MESSAGE,
              },
            ],
          },
        ]);
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // Check deterministic local intent first (instant, 100% reliable)
    const localMatch = getDeterministicLocalResponse(query, products);
    if (localMatch) {
      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-assistant`,
          sender: "ai",
          text: localMatch.text,
          actions: localMatch.actions,
        },
      ]);
      return;
    }

    requestInFlightRef.current = true;
    setIsThinking(true);

    try {
      const historyPayload: AiChatMessage[] = nextMessages
        .slice(-6)
        .map((message) => ({
          role:
            message.sender === "user"
              ? ("user" as const)
              : ("assistant" as const),
          content: message.text,
        }));

      const productSample = products
        .slice(0, 10)
        .map((product) => `${product.name} (R${product.price})`)
        .join(", ");

      const contextData = productSample
        ? [
            `Store brand: ${BRAND.name}.`,
            "Assistant identity: TJC-OS.",
            `Featured catalogue products: ${productSample}.`,
            `Total products in this catalogue snapshot: ${products.length}.`,
            "Catalogue data is not a guarantee of current stock or final pricing.",
            "Do not invent delivery times, returns policies, payment methods, or order status.",
            "Online checkout and payment processing must not be claimed as live unless verified.",
            "Official customer support is available through the WhatsApp action in the chat.",
          ].join(" ")
        : [
            `Store brand: ${BRAND.name}.`,
            "Assistant identity: TJC-OS.",
            "No catalogue products were available in this request.",
            "Do not invent products, prices, stock, delivery times, returns policies, payment methods, or order status.",
            "Official customer support is available through the WhatsApp action in the chat.",
          ].join(" ");

      const response = await sendAiChatMessage({
        data: {
          mode: "customer",
          messages: historyPayload,
          contextData,
        },
      });

      if (response.status === "rate_limited") {
        setMessages((previous) => [
          ...previous,
          {
            id: `${Date.now()}-assistant`,
            sender: "ai",
            text: "The AI assistant is receiving a high volume of requests right now. Please try again shortly or chat with our team on WhatsApp.",
            actions: [
              {
                type: "whatsapp",
                label: "Request Further Support",
                payload: WHATSAPP_SUPPORT_MESSAGE,
              },
            ],
          },
        ]);
      } else if (
        response.status === "unconfigured" ||
        response.status === "invalid_key"
      ) {
        setMessages((previous) => [
          ...previous,
          {
            id: `${Date.now()}-assistant`,
            sender: "ai",
            text: "I'm temporarily unable to access live AI responses. Our customer support team is available on WhatsApp to assist you directly.",
            actions: [
              {
                type: "whatsapp",
                label: "Request Further Support",
                payload: WHATSAPP_SUPPORT_MESSAGE,
              },
            ],
          },
        ]);
      } else if (response.status === "service_unavailable") {
        setMessages((previous) => [
          ...previous,
          {
            id: `${Date.now()}-assistant`,
            sender: "ai",
            text: "I'm temporarily unable to get a reliable answer from the AI service. Please try again shortly, or contact our support team on WhatsApp.",
            actions: [
              {
                type: "whatsapp",
                label: "Request Further Support",
                payload: WHATSAPP_SUPPORT_MESSAGE,
              },
            ],
          },
        ]);
      } else {
        const replyText = cleanAiResponseText(response.text?.trim() || "");

        if (!replyText) {
          setMessages((previous) => [
            ...previous,
            {
              id: `${Date.now()}-assistant`,
              sender: "ai",
              text: "I didn't receive a complete answer. Please try again, or contact our customer support team directly.",
              actions: [
                {
                  type: "whatsapp",
                  label: "Request Further Support",
                  payload: WHATSAPP_SUPPORT_MESSAGE,
                },
              ],
            },
          ]);
        } else {
          const actions: ChatAction[] | undefined =
            response.suggestedAction === "whatsapp"
              ? [
                  {
                    type: "whatsapp",
                    label: "Chat on WhatsApp",
                    payload: WHATSAPP_SUPPORT_MESSAGE,
                  },
                ]
              : undefined;

          setMessages((previous) => [
            ...previous,
            {
              id: `${Date.now()}-assistant`,
              sender: "ai",
              text: replyText,
              actions,
            },
          ]);
        }
      }
    } catch (error) {
      console.warn("AI chat request failed:", error);
      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-assistant`,
          sender: "ai",
          text: "I'm temporarily unable to connect to the AI service. Our customer support team is available on WhatsApp to help you right away.",
          actions: [
            {
              type: "whatsapp",
              label: "Request Further Support",
              payload: WHATSAPP_SUPPORT_MESSAGE,
            },
          ],
        },
      ]);
    } finally {
      requestInFlightRef.current = false;
      setIsThinking(false);
    }
  }

  function handleReset() {
    caseStateRef.current = { step: "idle" };
    setCaseState({ step: "idle" });
    setMessages([
      {
        ...getWelcomeMessage(),
        id: `welcome-${Date.now()}`,
        text: `Hello again! I'm TJC-OS, your AI assistant for ${BRAND.name}. How can I help you today?`,
      },
    ]);
    setInput("");
  }

  function handleWhatsAppSupport(payload?: string) {
    openWhatsApp(payload || WHATSAPP_SUPPORT_MESSAGE);
  }

  return (
    <>
      {!pageMode && (
        <div
          className="fixed bottom-24 right-3 z-[60] flex flex-col items-center gap-2 sm:bottom-6 sm:right-5"
          aria-label={`${BRAND.shortName} customer support`}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="WhatsApp support options"
              aria-expanded={menuOpen}
              className="grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg ring-1 ring-white/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
            >
              <WhatsAppIcon className="h-6 w-6 fill-current" />
            </button>

            {menuOpen && (
              <div className="absolute bottom-14 right-0 w-64 rounded-2xl border border-border bg-card p-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <p className="text-xs font-semibold text-foreground">
                    WhatsApp Support
                  </p>

                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Close menu"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      openWhatsApp(NEXA_QUICK_MESSAGE);
                      setMenuOpen(false);
                    }}
                    className="w-full rounded-xl bg-muted/60 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-[#25D366]/15 hover:text-[#128C7E]"
                  >
                    Chat with Customer Support
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const message = buildCartWhatsAppMessage(cart.items);
                      openWhatsApp(message);
                      setMenuOpen(false);
                    }}
                    className="w-full rounded-xl bg-[#25D366]/15 px-3 py-2 text-left text-xs font-semibold text-[#128C7E] transition-colors hover:bg-[#25D366]/25"
                  >
                    Order My Cart ({cart.items.length}{" "}
                    {cart.items.length === 1 ? "item" : "items"})
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void navigate({ to: "/ai-assistant" });
            }}
            aria-label="Open TJC-OS AI assistant"
            aria-expanded={pageMode || aiOpen}
            className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-tr from-amber-600 via-gold to-yellow-300 text-stone-950 shadow-lg ring-1 ring-white/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/40"
          >
            <Bot className="h-6 w-6" />

            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            </span>
          </button>
        </div>
      )}

      {(aiOpen || pageMode) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="TJC-OS AI assistant"
          className={
            pageMode
              ? "fixed inset-0 z-[100] flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden border-0 bg-[#080808] text-white shadow-2xl"
              : "fixed bottom-24 right-3 flex w-[calc(100vw-24px)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gold/40 bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 z-[70] sm:bottom-6 sm:right-20"
          }
        >
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-card via-card to-gold/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              {pageMode && (
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/" })}
                  className="mr-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Back to store"
                  aria-label="Back to store"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}

              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gold/20 text-gold shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  TJC-OS
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    AI Assistant
                  </span>
                </p>

                <p className="text-[11px] text-muted-foreground">
                  Powered by TJC-OS · {BRAND.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                title="Restart conversation"
                aria-label="Restart conversation"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (pageMode) {
                    void navigate({ to: "/" });
                  } else {
                    setAiOpen(false);
                  }
                }}
                title={pageMode ? "Return to store" : "Close chat"}
                aria-label={pageMode ? "Return to store" : "Close chat"}
                className="flex items-center gap-1 rounded-lg border border-border/40 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {pageMode && <span className="hidden sm:inline font-medium text-[11px]">Exit</span>}
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <button
              type="button"
              disabled={isThinking}
              onClick={() =>
                void handleSend("I want to open a support ticket")
              }
              className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
            >
              📝 Open Ticket
            </button>

            <button
              type="button"
              disabled={isThinking}
              onClick={() =>
                void handleSend("What are your delivery options across South Africa?")
              }
              className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-gold hover:text-foreground disabled:opacity-50"
            >
              📦 Delivery Options
            </button>

            <button
              type="button"
              disabled={isThinking}
              onClick={() =>
                void handleSend("How can I place an order via WhatsApp?")
              }
              className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-gold hover:text-foreground disabled:opacity-50"
            >
              🛒 Order via WhatsApp
            </button>

            <button
              type="button"
              disabled={isThinking}
              onClick={() => void handleSend("What is your returns policy?")}
              className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-gold hover:text-foreground disabled:opacity-50"
            >
              🔄 Returns
            </button>

            <button
              type="button"
              disabled={isThinking}
              onClick={() => void handleSend("I would like to speak to an agent")}
              className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-gold hover:text-foreground disabled:opacity-50"
            >
              💬 Human Support
            </button>
          </div>

          <div
            className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 text-xs ${
              pageMode ? "" : "h-80"
            }`}
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${
                  message.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm ${
                    message.sender === "user"
                      ? "rounded-br-xs bg-gold font-medium text-stone-950"
                      : "rounded-bl-xs border border-border/80 bg-muted/80 text-foreground"
                  }`}
                >
                  {message.text}
                </div>

                {/* Structured action buttons */}
                {((message.actions && message.actions.length > 0) ||
                  message.action?.type === "whatsapp") && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {message.actions?.map((act, index) => {
                      const isWhatsApp = act.type === "whatsapp";
                      const isLink = act.type === "link";
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            if (isWhatsApp) {
                              handleWhatsAppSupport(act.payload);
                            } else if (isLink && act.payload?.startsWith("/")) {
                              void navigate({ to: act.payload as any });
                            } else if (act.type === "case_step") {
                              void handleSend(act.payload ?? act.label);
                            }
                          }}
                          className={
                            isWhatsApp
                              ? "inline-flex items-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 py-1.5 text-[11px] font-semibold text-[#128C7E] transition-colors hover:bg-[#25D366]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50"
                              : "inline-flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold transition-colors hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                          }
                        >
                          {isWhatsApp && <WhatsAppIcon className="h-3.5 w-3.5 fill-current" />}
                          <span>{act.label}</span>
                          {isWhatsApp && <ExternalLink className="h-3 w-3 opacity-70" />}
                        </button>
                      );
                    })}
                    {!message.actions && message.action?.type === "whatsapp" && (
                      <button
                        type="button"
                        onClick={() => handleWhatsAppSupport()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 py-1.5 text-[11px] font-semibold text-[#128C7E] transition-colors hover:bg-[#25D366]/25"
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5 fill-current" />
                        <span>{message.action.label}</span>
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex items-center gap-2 self-start rounded-2xl border border-border/80 bg-muted/60 px-3.5 py-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
                <span className="text-[11px]">TJC-OS is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
            className="flex items-center gap-2 border-t border-border bg-card p-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask TJC-OS about products, orders or support..."
              disabled={isThinking}
              aria-label="Message TJC-OS"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />

            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="grid h-8 w-8 place-items-center rounded-xl bg-gold text-stone-950 transition-transform active:scale-95 disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
