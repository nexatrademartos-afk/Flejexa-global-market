import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Headset,
  ImagePlus,
  Mail,
  Minus,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Tags,
  Trash2,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Warehouse,
  Workflow,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { BRAND } from "@/lib/brand";
import { AdminAiCopilot } from "@/components/admin/AdminAiCopilot";
import { compressProductImage } from "@/lib/product-image";

type Product = Tables<"products">;
type Category = Tables<"categories">;
type Order = Tables<"orders">;
type RoleApplication = Tables<"role_applications">;
type ContactMessage = Tables<"contact_messages">;
type Banner = Tables<"banners">;
type RewardPoint = Tables<"reward_points">;

export type AdminTab =
  | "products"
  | "catalogue"
  | "orders"
  | "inventory"
  | "staff"
  | "suppliers"
  | "marketing"
  | "support"
  | "finance"
  | "intelligence";

const TABS: { id: AdminTab; label: string; icon: any; note: string }[] = [
  { id: "products", label: "Products", icon: Package, note: "Listings & images" },
  { id: "catalogue", label: "Catalogue", icon: Tags, note: "Categories & tags" },
  { id: "orders", label: "Orders & Returns", icon: ShoppingBag, note: "Customer orders" },
  { id: "inventory", label: "Inventory", icon: Warehouse, note: "Stock & alerts" },
  { id: "staff", label: "Staff & Approvals", icon: Users, note: "Role applications" },
  { id: "suppliers", label: "Suppliers & Partners", icon: Truck, note: "Partner accounts" },
  { id: "marketing", label: "Marketing", icon: BadgePercent, note: "Banners & promos" },
  { id: "support", label: "Support & Care", icon: Headset, note: "Customer inbox" },
  { id: "finance", label: "Finance & Wallets", icon: Wallet, note: "Revenue & rewards" },
  { id: "intelligence", label: "AI Intelligence", icon: BrainCircuit, note: "Insights & assistant" },
];

const MERCHANDISING_OPTIONS = [
  {
    value: "hot",
    label: "Hot",
    description: "Show in the Hot section.",
  },
  {
    value: "promotion",
    label: "Promotion",
    description: "Show in Promotions; set a comparison price for a sale.",
  },
  {
    value: "luxury",
    label: "Luxury / Premium",
    description: "Show in the Luxury section.",
  },
  {
    value: "affordable",
    label: "Affordable",
    description: "Show in the Affordable section.",
  },
  {
    value: "cheapest",
    label: "Cheapest",
    description: "Show in the Cheapest today highlight on the shop, lowest price first.",
  },
] as const;

type MerchandisingTag = (typeof MERCHANDISING_OPTIONS)[number]["value"];

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  image_url: string;
  is_active: boolean;
  sort_order: string;
};

const emptyCategoryForm: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  image_url: "",
  is_active: true,
  sort_order: "10",
};

type ProductForm = {
  name: string;
  slug: string;
  description: string;
  price: string;
  compare_at_price: string;
  stock: string;
  sku: string;
  gallery_urls: string[];
  image_url: string;
  category_id: string;
  is_active: boolean;
  is_featured: boolean;
  merchandising_tags: MerchandisingTag[];
};

const emptyForm: ProductForm = {
  name: "",
  slug: "",
  description: "",
  price: "",
  compare_at_price: "",
  stock: "0",
  sku: "",
  gallery_urls: [],
  image_url: "",
  category_id: "",
  is_active: false,
  is_featured: false,
  merchandising_tags: [],
};

type BannerForm = {
  title: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_link: string;
  is_active: boolean;
  sort_order: string;
};

const emptyBannerForm: BannerForm = {
  title: "",
  subtitle: "",
  image_url: "",
  cta_text: "Shop Now",
  cta_link: "/shop",
  is_active: true,
  sort_order: "0",
};

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    ...(typeof search["tab"] === "string" ? { tab: search["tab"] } : {}),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/workspace/$role",
      params: { role: "admin" },
      search: { tab: search.tab } as any,
    });
  },
  component: AdminRoutePage,
});

function AdminRoutePage() {
  const { tab } = Route.useSearch();
  return <AdminPage requestedTab={tab} />;
}

function makeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeTags(value: unknown): MerchandisingTag[] {
  if (!Array.isArray(value)) return [];
  const allowed = MERCHANDISING_OPTIONS.map((option) => option.value);
  return value.filter(
    (tag): tag is MerchandisingTag =>
      typeof tag === "string" && allowed.includes(tag as MerchandisingTag),
  );
}

const MAX_PRODUCT_IMAGES = 5;

function getProductImageUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  return supabase.storage
    .from("store-media")
    .getPublicUrl(path.replace(/^\/+/, "").replace(/^store-media\//, ""))
    .data.publicUrl;
}

export function AdminPage({
  requestedTab,
  embedded = false,
  onTabChange,
}: {
  requestedTab?: string | undefined;
  embedded?: boolean;
  onTabChange?: (tab: AdminTab) => void;
}) {
  const activeTab: AdminTab = TABS.some((item) => item.id === requestedTab)
    ? (requestedTab as AdminTab)
    : "products";

  const [user, setUser] = useState<{ id: string; email?: string | undefined } | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [rewards, setRewards] = useState<RewardPoint[]>([]);
  const [loadingModule, setLoadingModule] = useState(false);
  const [moduleError, setModuleError] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
    const [supportFilter, setSupportFilter] = useState<"all" | "unread" | "cases" | "urgent">("all");
const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [bannerForm, setBannerForm] = useState<BannerForm>(emptyBannerForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUploadError, setImageUploadError] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    const [productResult, categoryResult] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    ]);
    if (productResult.error) setErrorMessage(`Could not load products: ${productResult.error.message}`);
    else setProducts(productResult.data ?? []);
    if (categoryResult.error) setErrorMessage((current) => current ? `${current} Categories: ${categoryResult.error.message}` : `Could not load categories: ${categoryResult.error.message}`);
    else setCategories(categoryResult.data ?? []);
    setLoadingProducts(false);
  }, []);

  const loadModuleData = useCallback(async (tab: AdminTab) => {
    setLoadingModule(true);
    setModuleError("");
    try {
      if (tab === "products" || tab === "catalogue" || tab === "inventory" || tab === "intelligence" || tab === "finance") {
        await loadProducts();
      }
      if (tab === "orders" || tab === "finance" || tab === "intelligence") {
        const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
        if (error) throw error;
        setOrders(data ?? []);
      }
      if (tab === "staff" || tab === "suppliers" || tab === "intelligence") {
        const { data, error } = await supabase.from("role_applications").select("*").neq("requested_role", "admin").order("created_at", { ascending: false }).limit(500);
        if (error) throw error;
        setApplications(data ?? []);
      }
      if (tab === "support") {
        const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(500);
        if (error) throw error;
        setMessages(data ?? []);
      }
      if (tab === "marketing") {
        const { data, error } = await supabase.from("banners").select("*").order("sort_order", { ascending: true });
        if (error) throw error;
        setBanners(data ?? []);
      }
      if (tab === "finance") {
        const { data, error } = await supabase.from("reward_points").select("*").order("created_at", { ascending: false }).limit(200);
        if (error) throw error;
        setRewards(data ?? []);
      }
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : "Could not load this module. Check database permissions and try again.");
    } finally {
      setLoadingModule(false);
    }
  }, [loadProducts]);

  useEffect(() => {
    let active = true;
    async function checkAccess() {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !userResult.user) {
        setUser(null);
        setChecking(false);
        return;
      }
      setUser({ id: userResult.user.id, email: userResult.user.email });
      const { data: role, error } = await supabase.from("user_roles").select("role").eq("user_id", userResult.user.id).eq("role", "admin").maybeSingle();
      if (!active) return;
      setIsAdmin(!error && Boolean(role));
      setChecking(false);
    }
    void checkAccess();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isAdmin) void loadModuleData(activeTab);
  }, [isAdmin, activeTab, loadModuleData]);

  function updateForm<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateCategoryForm<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) {
    setCategoryForm((current) => ({ ...current, [key]: value }));
  }

  function updateBannerForm<K extends keyof BannerForm>(key: K, value: BannerForm[K]) {
    setBannerForm((current) => ({ ...current, [key]: value }));
  }

  function resetProductForm() {
    setShowProductForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setErrorMessage("");
    setImageUploadError(false);
  }

  function resetCategoryForm() {
    setShowCategoryForm(false);
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
  }

  function resetBannerForm() {
    setShowBannerForm(false);
    setEditingBannerId(null);
    setBannerForm(emptyBannerForm);
  }

  function startEditing(product: Product) {
    setShowProductForm(true);
    setEditingId(product.id);
    const gallery = Array.isArray(product.gallery) ? product.gallery.filter((item): item is string => typeof item === "string") : product.image_url ? [product.image_url] : [];
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      price: String(product.price),
      compare_at_price: product.compare_at_price == null ? "" : String(product.compare_at_price),
      stock: String(product.stock),
      sku: product.sku ?? "",
      gallery_urls: gallery,
      image_url: product.image_url ?? "",
      category_id: product.category_id ?? "",
      is_active: product.is_active,
      is_featured: product.is_featured,
      merchandising_tags: safeTags((product as Product & { merchandising_tags?: unknown }).merchandising_tags),
    });
    setImageUploadError(false);
    setMessage("");
    setErrorMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleTag(tag: MerchandisingTag, checked: boolean) {
    setForm((current) => ({
      ...current,
      merchandising_tags: checked ? Array.from(new Set([...current.merchandising_tags, tag])) : current.merchandising_tags.filter((item) => item !== tag),
    }));
  }

  async function uploadProductImages(files: FileList | null) {
  if (!files?.length) return;

  const selected = Array.from(files);
  const remaining = MAX_PRODUCT_IMAGES - form.gallery_urls.length;

  if (selected.length > remaining) {
    setErrorMessage(
      `You can add only ${remaining} more image(s). The limit is five per product.`,
    );
    return;
  }

  setUploadingImages(true);
  setErrorMessage("");
  setMessage("");

  const uploadedPaths: string[] = [];

  try {
    for (const file of selected) {
      const compressed = await compressProductImage(file);

      if (compressed.type !== "image/webp") {
        throw new Error(
          "Your browser could not create a WebP image. Please try another browser or image.",
        );
      }

      if (compressed.size > 150 * 1024) {
        throw new Error(
          "The compressed image is larger than 150 KB. Please choose another image.",
        );
      }

      const path = `products/${crypto.randomUUID()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from("store-media")
        .upload(path, compressed, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      uploadedPaths.push(path);

      // Confirm that the uploaded object can actually be retrieved.
      const { data: storedImage, error: verifyError } =
        await supabase.storage.from("store-media").download(path);

      if (verifyError) {
        throw new Error(
          `The image uploaded but could not be verified: ${verifyError.message}`,
        );
      }

      if (!storedImage || storedImage.size === 0) {
        throw new Error(
          "The uploaded image appears to be empty. Please try again.",
        );
      }
    }

    // Add images to the form only after the entire batch is verified.
    setForm((current) => ({
      ...current,
      gallery_urls: [...current.gallery_urls, ...uploadedPaths],
      image_url: current.image_url || uploadedPaths[0] || "",
    }));

    setImageUploadError(false);
    setMessage("Images uploaded and verified. Save the product to keep the changes.");
  } catch (error) {
    // Avoid leaving partially uploaded images behind if a batch fails.
    let cleanupMessage = "";

    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from("store-media")
        .remove(uploadedPaths);

      if (cleanupError) {
        cleanupMessage =
          ` Some temporary files could not be cleaned up: ${cleanupError.message}`;
      }
    }

    setImageUploadError(true);
    setErrorMessage(
      (error instanceof Error
        ? error.message
        : "Could not upload the images.") + cleanupMessage,
    );
  } finally {
    setUploadingImages(false);
  }
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadingImages) {
  setErrorMessage("Please wait for the image upload to finish.");
  return;
}

if (imageUploadError) {
  setErrorMessage(
    "An image upload failed. Please upload the image successfully before saving this product.",
  );
  return;
}
    setMessage("");
    setErrorMessage("");
    const name = form.name.trim();
    const slug = makeSlug(form.slug || name);
    const price = Number(form.price);
    const stock = Number(form.stock);
    const compareAtPrice = form.compare_at_price.trim() ? Number(form.compare_at_price) : null;
    if (!name || !slug) { setErrorMessage("Enter a product name and valid URL slug."); setSaving(false); return; }
    if (!Number.isFinite(price) || price <= 0) { setErrorMessage("Price must be greater than zero."); setSaving(false); return; }
    if (!Number.isInteger(stock) || stock < 0) { setErrorMessage("Stock must be a whole number of zero or more."); setSaving(false); return; }
    if (compareAtPrice != null && (!Number.isFinite(compareAtPrice) || compareAtPrice <= price)) { setErrorMessage("The comparison price must be greater than the selling price."); setSaving(false); return; }
    const values = {
      name, slug, description: form.description.trim() || null, price,
      compare_at_price: compareAtPrice,
      discount_pct: compareAtPrice != null ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : null,
      stock, sku: form.sku.trim() || null,
      image_url: form.image_url.trim() || form.gallery_urls[0] || null,
      gallery: form.gallery_urls.length ? form.gallery_urls : null,
      category_id: form.category_id || null,
      is_active: form.is_active, is_featured: form.is_featured,
      updated_at: new Date().toISOString(),
    };
    const result = editingId
      ? await supabase.from("products").update(values).eq("id", editingId)
      : await supabase.from("products").insert(values);
    if (result.error) { setErrorMessage(`Could not save the product: ${result.error.message}`); setSaving(false); return; }
    setMessage(editingId ? "Product updated successfully." : "Product added successfully.");
    resetProductForm();
    await loadProducts();
    setSaving(false);
  }

  function startEditingCategory(category: Category) {
    setShowCategoryForm(true);
    setEditingCategoryId(category.id);
    setCategoryForm({ name: category.name, slug: category.slug, description: category.description ?? "", image_url: category.image_url ?? "", is_active: category.is_active, sort_order: String(category.sort_order) });
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const name = categoryForm.name.trim();
    const slug = makeSlug(categoryForm.slug || name);
    const sortOrder = Number(categoryForm.sort_order);
    if (!name || !slug || !Number.isInteger(sortOrder) || sortOrder < 0) { setErrorMessage("Enter a category name, valid slug, and non-negative whole-number display order."); setSaving(false); return; }
    const values = { name, slug, description: categoryForm.description.trim() || null, image_url: categoryForm.image_url.trim() || null, is_active: categoryForm.is_active, sort_order: sortOrder, updated_at: new Date().toISOString() };
    const result = editingCategoryId ? await supabase.from("categories").update(values).eq("id", editingCategoryId) : await supabase.from("categories").insert(values);
    if (result.error) { setErrorMessage(`Could not save category: ${result.error.message}`); setSaving(false); return; }
    setMessage(editingCategoryId ? "Category updated." : "Category created.");
    resetCategoryForm();
    await loadProducts();
    setSaving(false);
  }

  async function toggleCategory(category: Category) {
    const { error } = await supabase.from("categories").update({ is_active: !category.is_active, updated_at: new Date().toISOString() }).eq("id", category.id);
    if (error) { setErrorMessage(error.message); return; }
    await loadProducts();
    setMessage(category.is_active ? "Category deactivated." : "Category activated.");
  }

  async function deleteCategory(category: Category) {
    const assigned = products.filter((product) => product.category_id === category.id).length;
    if (assigned) { setErrorMessage(`Cannot delete “${category.name}” because ${assigned} product(s) are assigned to it. Reassign them first.`); return; }
    if (!window.confirm(`Delete category “${category.name}”? This cannot be undone.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) { setErrorMessage(`Could not delete category: ${error.message}`); return; }
    setCategories((current) => current.filter((item) => item.id !== category.id));
    setMessage("Category deleted.");
  }

  async function toggleProduct(product: Product, field: "is_active" | "is_featured") {
    const nextValue = !product[field];
    const update = field === "is_active" ? { is_active: nextValue, updated_at: new Date().toISOString() } : { is_featured: nextValue, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("products").update(update).eq("id", product.id);
    if (error) { setErrorMessage(error.message); return; }
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, [field]: nextValue } : item));
    setMessage(field === "is_active" ? nextValue ? "Product published." : "Product unpublished." : nextValue ? "Product marked as featured." : "Product removed from featured items.");
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Permanently delete “${product.name}”? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) { setErrorMessage(`Could not delete product: ${error.message}`); return; }
    setProducts((current) => current.filter((item) => item.id !== product.id));
    setMessage("Product deleted.");
  }

  async function updateOrder(order: Order, field: "status" | "payment_status", value: string) {
    if (!window.confirm(`Update ${field.replace("_", " ")} for order ${order.id.slice(0, 8)} to “${value}”?`)) return;
    const update = field === "status" ? { status: value, updated_at: new Date().toISOString() } : { payment_status: value, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("orders").update(update).eq("id", order.id);
    if (error) { setModuleError(`Could not update order: ${error.message}`); return; }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, [field]: value } : item));
    setMessage("Order updated successfully.");
  }

  async function updateStock(product: Product, nextStock: number) {
    const stock = Math.max(0, Math.floor(nextStock));
    const { error } = await supabase.from("products").update({ stock, updated_at: new Date().toISOString() }).eq("id", product.id);
    if (error) { setModuleError(`Could not update stock: ${error.message}`); return; }
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock } : item));
    setMessage(`${product.name} stock updated to ${stock}.`);
  }

  async function reviewApplication(application: RoleApplication, status: "approved" | "rejected") {
    // Administration applications are CEO-only. The database enforces this too; this check only gives a clear message.
    if (application.requested_role === "admin") { setModuleError("Administration applications can only be decided by the CEO."); return; }
    const notes = reviewNotes[application.id]?.trim() || undefined;
    const args: { p_application_id: string; p_decision: string; p_review_notes?: string } = { p_application_id: application.id, p_decision: status };
    if (notes) args.p_review_notes = notes;
    const { error } = await supabase.rpc("review_role_application", args);
    if (error) { setModuleError(`Could not update application: ${error.message}`); return; }
    setApplications((current) => current.map((item) => item.id === application.id ? { ...item, status, review_notes: notes ?? null, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() } : item));
    setMessage(`Application ${status}. Note: role approval also needs a matching user_roles assignment before access is granted.`);
  }

  async function toggleMessageRead(item: ContactMessage) {
    const { error } = await supabase.from("contact_messages").update({ is_read: !item.is_read }).eq("id", item.id);
    if (error) { setModuleError(`Could not update message: ${error.message}`); return; }
    setMessages((current) => current.map((message) => message.id === item.id ? { ...message, is_read: !item.is_read } : message));
  }

  function startEditingBanner(banner: Banner) {
    setShowBannerForm(true);
    setEditingBannerId(banner.id);
    setBannerForm({ title: banner.title, subtitle: banner.subtitle ?? "", image_url: banner.image_url ?? "", cta_text: banner.cta_text ?? "Shop Now", cta_link: banner.cta_link ?? "/shop", is_active: banner.is_active, sort_order: String(banner.sort_order) });
  }

  async function saveBanner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const title = bannerForm.title.trim();
    const sortOrder = Number(bannerForm.sort_order);
    if (!title || !Number.isInteger(sortOrder) || sortOrder < 0) { setModuleError("Enter a banner title and non-negative whole-number sort order."); setSaving(false); return; }
    const values = { title, subtitle: bannerForm.subtitle.trim() || null, image_url: bannerForm.image_url.trim() || null, cta_text: bannerForm.cta_text.trim() || null, cta_link: bannerForm.cta_link.trim() || null, is_active: bannerForm.is_active, sort_order: sortOrder, updated_at: new Date().toISOString() };
    const result = editingBannerId ? await supabase.from("banners").update(values).eq("id", editingBannerId) : await supabase.from("banners").insert(values);
    if (result.error) { setModuleError(`Could not save banner: ${result.error.message}`); setSaving(false); return; }
    resetBannerForm();
    await loadModuleData("marketing");
    setMessage(editingBannerId ? "Banner updated." : "Banner created.");
    setSaving(false);
  }

  async function toggleBanner(banner: Banner) {
    const { error } = await supabase.from("banners").update({ is_active: !banner.is_active, updated_at: new Date().toISOString() }).eq("id", banner.id);
    if (error) { setModuleError(error.message); return; }
    setBanners((current) => current.map((item) => item.id === banner.id ? { ...item, is_active: !banner.is_active } : item));
  }

  async function deleteBanner(banner: Banner) {
    if (!window.confirm(`Delete the banner “${banner.title}”?`)) return;
    const { error } = await supabase.from("banners").delete().eq("id", banner.id);
    if (error) { setModuleError(`Could not delete banner: ${error.message}`); return; }
    setBanners((current) => current.filter((item) => item.id !== banner.id));
  }

  const filteredProducts = useMemo(() => products.filter((product) => {
    const q = searchText.trim().toLowerCase();
    if (q && !`${product.name} ${product.slug} ${product.sku ?? ""}`.toLowerCase().includes(q)) return false;
    if (statusFilter === "published") return product.is_active;
    if (statusFilter === "draft") return !product.is_active;
    if (statusFilter === "low-stock") return product.stock > 0 && product.stock <= lowStockThreshold;
    if (statusFilter === "out-of-stock") return product.stock <= 0;
    return true;
  }), [products, searchText, statusFilter, lowStockThreshold]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const q = searchText.trim().toLowerCase();
    const matchesSearch = !q || `${order.customer_name} ${order.customer_email ?? ""} ${order.id} ${order.payment_reference ?? ""}`.toLowerCase().includes(q);
    return matchesSearch && (statusFilter === "all" || order.status.toLowerCase() === statusFilter || order.payment_status.toLowerCase() === statusFilter);
  }), [orders, searchText, statusFilter]);

  const filteredApplications = useMemo(() => applications.filter((application) => {
    const q = searchText.trim().toLowerCase();
    const matchesSearch = !q || `${application.applicant_id} ${application.requested_role} ${application.status}`.toLowerCase().includes(q);
    return matchesSearch && (statusFilter === "all" || application.status.toLowerCase() === statusFilter);
  }), [applications, searchText, statusFilter]);

  const filteredMessages = useMemo(() => messages.filter((item) => {
    const q = searchText.trim().toLowerCase();
    const matchesSearch = !q || `${item.name} ${item.email} ${item.phone ?? ""} ${item.subject ?? ""} ${item.message}`.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (supportFilter === "unread") return !item.is_read;
    if (supportFilter === "cases") return Boolean(item.subject?.includes("[CASE-"));
    if (supportFilter === "urgent") {
      return Boolean(item.subject?.includes("[🚨 Fraud / Security]") || item.message?.includes("Priority: HIGH") || item.subject?.includes("Security"));
    }
    return true;
  }), [messages, searchText, supportFilter]);

  const lowStockProducts = products.filter((product) => product.stock <= lowStockThreshold);
  const totalRevenue = orders.filter((order) => !["cancelled", "refunded", "returned"].includes(order.status.toLowerCase())).reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paidRevenue = orders.filter((order) => order.payment_status.toLowerCase() === "paid").reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrders = orders.filter((order) => ["pending", "processing", "paid"].includes(order.status.toLowerCase())).length;
  const pendingApplications = applications.filter((application) => application.status.toLowerCase() === "pending").length;
  const unreadMessages = messages.filter((item) => !item.is_read).length;

  const currency = (value: number) => `R${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateLabel = (value: string) => new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
  const panelClass = "surface rounded-2xl border p-4 sm:p-6";
  const buttonClass = "btn btn-outline";

  if (checking) return <main className="min-h-screen px-4 py-12 text-foreground"><p className="mx-auto max-w-xl rounded-xl border border-border bg-card p-5">Checking administrator access…</p></main>;
  if (!user) return <main className="min-h-screen px-4 py-12 text-foreground"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-gold" /><h1 className="mt-4 text-2xl font-bold">Administrator sign-in required</h1><p className="mt-2 text-sm text-muted-foreground">Sign in with an account that has the administrator role.</p><Link to="/sign-in" className="btn btn-primary mt-5 inline-flex">Go to sign in</Link></section></main>;
  if (!isAdmin) return <main className="min-h-screen px-4 py-12 text-foreground"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-gold" /><h1 className="mt-4 text-2xl font-bold">Administrator access required</h1><p className="mt-2 text-sm text-muted-foreground">This area is for authorised administrators only.</p><Link to="/account" className="btn btn-outline mt-5 inline-flex">Return to account</Link></section></main>;

  const activeTabData = TABS.find((tab) => tab.id === activeTab)!;
  const ActiveIcon = activeTabData.icon;
  const setTab = (tab: AdminTab) => {
    if (embedded) onTabChange?.(tab);
    else window.location.href = `/workspace/admin?tab=${tab}`;
    setSearchText("");
    setStatusFilter("all");
    setErrorMessage("");
    setMessage("");
    setModuleError("");
  };

  function renderCategoryPanel() {
    return <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Category manager</h2><p className="mt-1 text-sm text-muted-foreground">Create categories for storefront navigation and assign them to products.</p></div><button className="btn btn-primary" type="button" onClick={() => { setShowCategoryForm(true); setCategoryForm(emptyCategoryForm); setEditingCategoryId(null); }}><Plus className="mr-2 h-4 w-4" />Add category</button></div>
      {showCategoryForm && <form className={`${panelClass} space-y-4`} onSubmit={saveCategory}><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm">Category name *<input required value={categoryForm.name} onChange={(e) => updateCategoryForm("name", e.target.value)} className="field" /></label><label className="grid gap-1 text-sm">URL slug *<input required value={categoryForm.slug} onChange={(e) => updateCategoryForm("slug", makeSlug(e.target.value))} className="field" /></label><label className="grid gap-1 text-sm">Image URL<input type="url" value={categoryForm.image_url} onChange={(e) => updateCategoryForm("image_url", e.target.value)} className="field" /></label><label className="grid gap-1 text-sm">Display order<input type="number" min="0" step="1" value={categoryForm.sort_order} onChange={(e) => updateCategoryForm("sort_order", e.target.value)} className="field" /></label></div><label className="grid gap-1 text-sm">Description<textarea value={categoryForm.description} onChange={(e) => updateCategoryForm("description", e.target.value)} className="field" rows={2} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoryForm.is_active} onChange={(e) => updateCategoryForm("is_active", e.target.checked)} />Active on storefront</label><div className="flex gap-2"><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : editingCategoryId ? "Save category" : "Create category"}</button><button className={buttonClass} type="button" onClick={resetCategoryForm}>Cancel</button></div></form>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{categories.map((category) => { const count = products.filter((product) => product.category_id === category.id).length; return <article key={category.id} className={`${panelClass} flex flex-col gap-3`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{category.name}</h3><p className="text-xs text-muted-foreground">/{category.slug} · Order {category.sort_order}</p></div><span className={`rounded-full px-2 py-1 text-xs ${category.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>{category.is_active ? "Active" : "Inactive"}</span></div><p className="text-sm text-muted-foreground">{category.description || "No description"}</p><p className="text-sm">{count} product{count === 1 ? "" : "s"}</p><div className="mt-auto flex flex-wrap gap-2"><button className={buttonClass} type="button" onClick={() => startEditingCategory(category)}>Edit</button><button className={buttonClass} type="button" onClick={() => void toggleCategory(category)}>{category.is_active ? "Deactivate" : "Activate"}</button><button className={buttonClass} type="button" onClick={() => void deleteCategory(category)} disabled={count > 0}><Trash2 className="mr-1 h-4 w-4" />Delete</button></div></article>; })}</div>
      {!categories.length && <div className={panelClass}><p className="font-semibold">No categories yet</p><p className="mt-1 text-sm text-muted-foreground">Create your first category above.</p></div>}
    </div>;
  }

  function renderOrders() {
    const itemList = (order: Order) => Array.isArray(order.items) ? order.items as unknown[] : [];
    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Orders & returns</h2><p className="mt-1 text-sm text-muted-foreground">Review orders, update fulfilment and payment status.</p></div><button className={buttonClass} type="button" onClick={() => void loadModuleData("orders")}><RefreshCw className="mr-2 h-4 w-4" />Refresh</button></div><div className="grid gap-3 sm:grid-cols-3"><StatCard label="All orders" value={String(orders.length)} note="Live database records" /><StatCard label="Needs attention" value={String(pendingOrders)} note="Pending or processing" /><StatCard label="Paid revenue" value={currency(paidRevenue)} note="Orders marked paid" /></div>
      <div className="flex flex-wrap gap-2"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field w-auto"><option value="all">All statuses</option>{["pending", "processing", "paid", "shipped", "delivered", "cancelled", "returned", "refunded"].map((s) => <option key={s} value={s}>{s}</option>)}</select><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search name, email, order ID" className="field min-w-56 flex-1" /></div>
      <div className="space-y-3">{filteredOrders.map((order) => <article key={order.id} className={panelClass}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">Order #{order.id.slice(0, 8)}</p><p className="text-sm text-muted-foreground">{order.customer_name} · {order.customer_email || order.customer_phone}</p><p className="mt-1 text-xs text-muted-foreground">{dateLabel(order.created_at)} · {itemList(order).length} line item(s)</p></div><div className="text-right"><p className="font-bold text-gold">{currency(Number(order.total))}</p><p className="text-xs">{order.payment_method} · {order.payment_status}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs text-muted-foreground">Order status<select value={order.status} onChange={(e) => void updateOrder(order, "status", e.target.value)} className="field text-sm">{["pending", "processing", "paid", "shipped", "delivered", "cancelled", "returned", "refunded"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label><label className="grid gap-1 text-xs text-muted-foreground">Payment status<select value={order.payment_status} onChange={(e) => void updateOrder(order, "payment_status", e.target.value)} className="field text-sm">{["pending", "paid", "failed", "refunded", "partially_refunded"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label></div><button type="button" className="mt-3 text-sm text-gold underline" onClick={() => setOrderDetail(order)}>View order details</button></article>)}{!filteredOrders.length && <div className={panelClass}>No matching orders.</div>}</div>
      {orderDetail && <Modal title={`Order #${orderDetail.id.slice(0, 8)}`} onClose={() => setOrderDetail(null)}><div className="space-y-4"><p><strong>Customer:</strong> {orderDetail.customer_name} · {orderDetail.customer_email} · {orderDetail.customer_phone}</p><p><strong>Address:</strong> {orderDetail.customer_address || "Not provided"}</p><p><strong>Payment reference:</strong> {orderDetail.payment_reference || "Not recorded"}</p><p><strong>Notes:</strong> {orderDetail.notes || "None"}</p><div><strong>Items:</strong><pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(orderDetail.items, null, 2)}</pre></div></div></Modal>}
    </div>;
  }

  function renderInventory() {
    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Inventory & warehouses</h2><p className="mt-1 text-sm text-muted-foreground">Current stock is managed per product. Warehouse transfers are not configured yet.</p></div><label className="flex items-center gap-2 text-sm">Low-stock threshold <input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(Math.max(0, Number(e.target.value)))} className="field w-20" /></label></div><div className="grid gap-3 sm:grid-cols-3"><StatCard label="Tracked products" value={String(products.length)} note="Product records" /><StatCard label="Low / out of stock" value={String(lowStockProducts.length)} note={`At or below ${lowStockThreshold} units`} /><StatCard label="Total units" value={String(products.reduce((sum, item) => sum + item.stock, 0))} note="Across all products" /></div><div className="flex gap-2"><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search product or SKU" className="field flex-1" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field w-auto"><option value="all">All stock</option><option value="low-stock">Low stock</option><option value="out-of-stock">Out of stock</option></select></div><div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3">Adjust</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id} className="border-t"><td className="p-3 font-medium">{product.name}</td><td className="p-3">{product.sku || "—"}</td><td className="p-3 font-bold">{product.stock}</td><td className="p-3">{product.stock <= 0 ? <span className="text-red-400">Out of stock</span> : product.stock <= lowStockThreshold ? <span className="text-amber-400">Low stock</span> : <span className="text-emerald-400">In stock</span>}</td><td className="p-3"><div className="flex items-center gap-2"><button type="button" className="btn btn-outline px-2 py-1" onClick={() => void updateStock(product, product.stock - 1)} aria-label="Decrease stock"><Minus className="h-4 w-4" /></button><input type="number" min="0" defaultValue={product.stock} key={`${product.id}-${product.stock}`} onBlur={(e) => { const next = Number(e.currentTarget.value); if (Number.isFinite(next) && next !== product.stock) void updateStock(product, next); }} className="field w-20" /><button type="button" className="btn btn-outline px-2 py-1" onClick={() => void updateStock(product, product.stock + 1)} aria-label="Increase stock"><Plus className="h-4 w-4" /></button></div></td></tr>)}</tbody></table>{!filteredProducts.length && <p className="p-4 text-sm text-muted-foreground">No products match this filter.</p>}</div></div>;
  }

  function renderApplications(suppliersOnly = false) {
    const visible = filteredApplications.filter((application) => suppliersOnly ? application.requested_role === "partner" : true);
    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{suppliersOnly ? "Suppliers & partners" : "Staff & role approvals"}</h2><p className="mt-1 text-sm text-muted-foreground">Review role applications. Approval updates the application record; access still depends on role assignment.</p></div><span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm text-amber-300">{pendingApplications} pending</span></div><div className="flex flex-wrap gap-2"><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search applicant ID or role" className="field flex-1" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field w-auto"><option value="all">All applications</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div><div className="space-y-3">{visible.map((application) => <article key={application.id} className={panelClass}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{application.requested_role} application</p><p className="text-xs text-muted-foreground">Applicant {application.applicant_id} · {dateLabel(application.created_at)}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{application.status}</span></div><p className="mt-3 text-sm">{application.application_message || "No application note provided."}</p>{application.review_notes && <p className="mt-2 text-sm text-muted-foreground">Review note: {application.review_notes}</p>}{application.status.toLowerCase() === "pending" && <div className="mt-4 space-y-2"><textarea className="field w-full" rows={2} placeholder="Optional review note" value={reviewNotes[application.id] ?? ""} onChange={(e) => setReviewNotes((current) => ({ ...current, [application.id]: e.target.value }))} /><div className="flex gap-2"><button className="btn btn-primary" type="button" onClick={() => void reviewApplication(application, "approved")}><CheckCircle2 className="mr-2 h-4 w-4" />Approve application</button><button className={buttonClass} type="button" onClick={() => void reviewApplication(application, "rejected")}>Reject</button></div></div>}</article>)}{!visible.length && <div className={panelClass}>No applications found.</div>}</div></div>;
  }

  function renderMarketing() {
    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Marketing & banners</h2><p className="mt-1 text-sm text-muted-foreground">Manage published storefront banners. This does not create discount codes.</p></div><button className="btn btn-primary" type="button" onClick={() => { setBannerForm(emptyBannerForm); setEditingBannerId(null); setShowBannerForm(true); }}><Plus className="mr-2 h-4 w-4" />Add banner</button></div>{showBannerForm && <form onSubmit={saveBanner} className={`${panelClass} space-y-4`}><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm">Title *<input required className="field" value={bannerForm.title} onChange={(e) => updateBannerForm("title", e.target.value)} /></label><label className="grid gap-1 text-sm">Subtitle<input className="field" value={bannerForm.subtitle} onChange={(e) => updateBannerForm("subtitle", e.target.value)} /></label><label className="grid gap-1 text-sm">Image URL<input type="url" className="field" value={bannerForm.image_url} onChange={(e) => updateBannerForm("image_url", e.target.value)} /></label><label className="grid gap-1 text-sm">Display order<input type="number" min="0" step="1" className="field" value={bannerForm.sort_order} onChange={(e) => updateBannerForm("sort_order", e.target.value)} /></label><label className="grid gap-1 text-sm">Button text<input className="field" value={bannerForm.cta_text} onChange={(e) => updateBannerForm("cta_text", e.target.value)} /></label><label className="grid gap-1 text-sm">Button link<input className="field" value={bannerForm.cta_link} onChange={(e) => updateBannerForm("cta_link", e.target.value)} /></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bannerForm.is_active} onChange={(e) => updateBannerForm("is_active", e.target.checked)} />Active banner</label><div className="flex gap-2"><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : editingBannerId ? "Save banner" : "Create banner"}</button><button className={buttonClass} type="button" onClick={resetBannerForm}>Cancel</button></div></form>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{banners.map((banner) => <article key={banner.id} className={panelClass}>{banner.image_url && <img src={banner.image_url} alt="" className="mb-3 h-36 w-full rounded-xl object-cover" />}<h3 className="font-semibold">{banner.title}</h3><p className="mt-1 text-sm text-muted-foreground">{banner.subtitle || "No subtitle"}</p><p className="mt-2 text-xs">Order {banner.sort_order} · {banner.is_active ? "Active" : "Inactive"}</p><div className="mt-3 flex flex-wrap gap-2"><button className={buttonClass} type="button" onClick={() => startEditingBanner(banner)}>Edit</button><button className={buttonClass} type="button" onClick={() => void toggleBanner(banner)}>{banner.is_active ? "Deactivate" : "Activate"}</button><button className={buttonClass} type="button" onClick={() => void deleteBanner(banner)}>Delete</button></div></article>)}</div>{!banners.length && <div className={panelClass}>No banners yet. Add a banner to begin.</div>}</div>;
  }

  function renderSupport() {
    const caseCount = messages.filter((m) => m.subject?.includes("[CASE-")).length;
    const urgentCount = messages.filter((m) => m.subject?.includes("[🚨 Fraud / Security]") || m.message?.includes("Priority: HIGH") || m.subject?.includes("Security")).length;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Customer support inbox</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review and manage verified customer support cases, inquiries, and follow-ups.
            </p>
          </div>
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm text-amber-300 font-medium">
            {unreadMessages} unread
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSupportFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${supportFilter === "all" ? "bg-gold text-stone-950" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            All ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setSupportFilter("unread")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${supportFilter === "unread" ? "bg-amber-500 text-stone-950" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            Unread ({unreadMessages})
          </button>
          <button
            type="button"
            onClick={() => setSupportFilter("cases")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${supportFilter === "cases" ? "bg-gold text-stone-950" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            Logged Cases ({caseCount})
          </button>
          <button
            type="button"
            onClick={() => setSupportFilter("urgent")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${supportFilter === "urgent" ? "bg-red-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            🚨 Urgent & Security ({urgentCount})
          </button>
        </div>

        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by name, email, phone, reference, or message..."
          className="field w-full"
        />

        <div className="space-y-3">
          {filteredMessages.map((item) => {
            const caseMatch = item.subject?.match(/\[(CASE-[A-Z0-9]+)\]/);
            const caseRef = caseMatch ? caseMatch[1] : null;
            const isUrgent = item.subject?.includes("[🚨 Fraud / Security]") || item.message?.includes("Priority: HIGH") || item.subject?.includes("Security");
            const waGreeting = caseRef
              ? encodeURIComponent(`Hello ${item.name}, this is NEXA GLOBAL MART customer support following up on your case ${caseRef}.`)
              : encodeURIComponent(`Hello ${item.name}, this is NEXA GLOBAL MART customer support following up on your enquiry.`);

            return (
              <article key={item.id} className={`${panelClass} ${item.is_read ? "opacity-80" : "border-gold/40"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">{item.subject || "Customer inquiry"}</h3>
                      {caseRef && (
                        <span className="rounded-md bg-gold/15 border border-gold/30 px-2 py-0.5 font-mono text-[11px] font-bold text-gold">
                          {caseRef}
                        </span>
                      )}
                      {isUrgent && (
                        <span className="rounded-md border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                          🚨 Urgent Priority
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.name} · {item.email} · {item.phone || "No phone provided"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{dateLabel(item.created_at)}</span>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{item.message}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    className={buttonClass}
                    href={`mailto:${item.email}?subject=${encodeURIComponent(`Re: ${item.subject || "Your enquiry"}`)}`}
                  >
                    <Mail className="mr-2 h-4 w-4" />Email customer
                  </a>
                  {item.phone && (
                    <a
                      className={buttonClass}
                      href={`https://wa.me/${item.phone.replace(/\D/g, "")}?text=${waGreeting}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Phone className="mr-2 h-4 w-4" />WhatsApp customer
                    </a>
                  )}
                  <button className={buttonClass} type="button" onClick={() => void toggleMessageRead(item)}>
                    {item.is_read ? "Mark unread" : "Mark read"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {filteredMessages.length === 0 && (
          <div className={panelClass}>
            {messages.length === 0
              ? "No customer support messages yet. When customers submit inquiries, they will appear here."
              : "No support messages match your search or filter."}
          </div>
        )}
      </div>
    );
  }

  function renderFinance() {
    return <div className="space-y-5"><div><h2 className="text-xl font-bold">Finance & wallet overview</h2><p className="mt-1 text-sm text-muted-foreground">Figures are derived from current order and reward records; this is not a payment processor or withdrawable wallet.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Orders total" value={currency(totalRevenue)} note="Excludes cancelled / returned / refunded order statuses" /><StatCard label="Paid orders" value={currency(paidRevenue)} note="Payment status = paid" /><StatCard label="Orders" value={String(orders.length)} note="All loaded records" /><StatCard label="Reward entries" value={String(rewards.length)} note="Latest 200 records" /></div><section className={panelClass}><h3 className="font-semibold">Reward points ledger</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase text-muted-foreground"><tr><th className="p-2">Date</th><th className="p-2">User</th><th className="p-2">Reason</th><th className="p-2">Points</th><th className="p-2">Status</th></tr></thead><tbody>{rewards.map((reward) => <tr key={reward.id} className="border-t"><td className="p-2">{dateLabel(reward.created_at)}</td><td className="p-2">{reward.user_id.slice(0, 8)}…</td><td className="p-2">{reward.reason}</td><td className="p-2">{reward.points}</td><td className="p-2">{reward.status}</td></tr>)}</tbody></table>{!rewards.length && <p className="py-4 text-sm text-muted-foreground">No reward entries.</p>}</div></section><section className={`${panelClass} border-amber-400/30`}><p className="font-semibold text-amber-200">Wallet and payout limitation</p><p className="mt-1 text-sm text-muted-foreground">No financial wallet, settlement, refund, or payout table/provider is connected in the repository schema. This module reports recorded order totals and reward points only. It does not initiate transfers or payment refunds.</p></section></div>;
  }

  function renderIntelligence() {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Low / out of stock"
            value={String(lowStockProducts.length)}
            note={`Threshold: ${lowStockThreshold} units`}
          />
          <StatCard
            label="Pending orders"
            value={String(pendingOrders)}
            note="Pending, processing or paid"
          />
          <StatCard
            label="Applications pending"
            value={String(pendingApplications)}
            note="Awaiting review"
          />
          <StatCard
            label="Potential order revenue"
            value={currency(totalRevenue)}
            note="Based on non-cancelled/returned records"
          />
        </div>

        <AdminAiCopilot
          products={products}
          orders={orders}
          applications={applications}
          messages={messages}
          totalRevenue={totalRevenue}
          paidRevenue={paidRevenue}
          pendingOrders={pendingOrders}
          lowStockProducts={lowStockProducts}
          currency={currency}
        />
      </div>
    );
  }

  function renderProducts() {
    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Products</h2><p className="mt-1 text-sm text-muted-foreground">Add and manage live product listings, pricing, stock and up to five images.</p></div><button className="btn btn-primary" type="button" onClick={() => { setForm(emptyForm); setEditingId(null); setShowProductForm(true); }}><Plus className="mr-2 h-4 w-4" />Add product</button></div>
      {showProductForm && <form onSubmit={saveProduct} className={`${panelClass} space-y-4`}><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{editingId ? "Edit product" : "Add product"}</h3><button type="button" className={buttonClass} onClick={resetProductForm}>Close</button></div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm">Product name *<input required className="field" value={form.name} onChange={(e) => { const name = e.target.value; updateForm("name", name); if (!editingId) updateForm("slug", makeSlug(name)); }} /></label><label className="grid gap-1 text-sm">URL slug *<input required className="field" value={form.slug} onChange={(e) => updateForm("slug", makeSlug(e.target.value))} /></label><label className="grid gap-1 text-sm">Price (ZAR) *<input required type="number" min="0.01" step="0.01" className="field" value={form.price} onChange={(e) => updateForm("price", e.target.value)} /></label><label className="grid gap-1 text-sm">Compare-at price<input type="number" min="0" step="0.01" className="field" value={form.compare_at_price} onChange={(e) => updateForm("compare_at_price", e.target.value)} /></label><label className="grid gap-1 text-sm">Stock *<input required type="number" min="0" step="1" className="field" value={form.stock} onChange={(e) => updateForm("stock", e.target.value)} /></label><label className="grid gap-1 text-sm">SKU<input className="field" value={form.sku} onChange={(e) => updateForm("sku", e.target.value)} /></label><label className="grid gap-1 text-sm">Category<select className="field" value={form.category_id} onChange={(e) => updateForm("category_id", e.target.value)}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div><label className="grid gap-1 text-sm">Description<textarea rows={4} className="field" value={form.description} onChange={(e) => updateForm("description", e.target.value)} /></label><section><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Product images ({form.gallery_urls.length}/{MAX_PRODUCT_IMAGES})</p><p className="text-xs text-muted-foreground">Upload up to five images. The first image is the primary image.</p></div><label className="btn btn-outline cursor-pointer"><ImagePlus className="mr-2 h-4 w-4" />{uploadingImages ? "Uploading…" : "Upload images"}<input type="file" accept="image/*" multiple disabled={uploadingImages || form.gallery_urls.length >= MAX_PRODUCT_IMAGES} className="hidden" onChange={(e) => { void uploadProductImages(e.target.files); e.currentTarget.value = ""; }} /></label></div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">{form.gallery_urls.map((path, index) => <div key={`${path}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border"><img src={getProductImageUrl(path)} alt={`Product image ${index + 1}`} className="h-full w-full object-cover" /><span className="absolute bottom-1 left-1 rounded bg-black/70 px-2 py-1 text-[10px] text-white">{index === 0 ? "Primary" : `Image ${index + 1}`}</span><button type="button" aria-label="Remove image" onClick={() => removeProductImage(path)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/80 text-white"><X className="h-4 w-4" /></button></div>)}</div></section><div className="flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => updateForm("is_active", e.target.checked)} />Published</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_featured} onChange={(e) => updateForm("is_featured", e.target.checked)} />Featured</label></div><div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={saving || uploadingImages}>{saving ? "Saving…" : editingId ? "Save product" : "Create product"}</button><button className={buttonClass} type="button" onClick={resetProductForm}>Cancel</button></div></form>}
      <div className="flex flex-wrap gap-2"><input className="field min-w-56 flex-1" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search products or SKU" /><select className="field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All products</option><option value="published">Published</option><option value="draft">Unpublished</option><option value="low-stock">Low stock</option><option value="out-of-stock">Out of stock</option></select><button className={buttonClass} type="button" onClick={() => void loadProducts()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</button></div>
      {loadingProducts || loadingModule ? <div className={panelClass}>Loading products…</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filteredProducts.map((product) => { const gallery = Array.isArray(product.gallery) ? product.gallery.filter((item): item is string => typeof item === "string") : []; const images = gallery.length ? gallery : product.image_url ? [product.image_url] : []; return <article key={product.id} className="surface overflow-hidden rounded-2xl border"><button type="button" className="block aspect-[4/3] w-full bg-muted" onClick={() => { setPreviewProduct(product); setPreviewImageIndex(0); }}>{images[0] ? <img src={getProductImageUrl(images[0])} alt={product.name} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><Package className="h-12 w-12 text-muted-foreground" /></span>}</button><div className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{product.name}</h3><span className={`rounded-full px-2 py-1 text-xs ${product.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>{product.is_active ? "Published" : "Draft"}</span></div><p className="text-lg font-bold text-gold">{currency(Number(product.price))}</p><p className="text-xs text-muted-foreground">Stock {product.stock} · {images.length} image(s){product.sku ? ` · ${product.sku}` : ""}</p><div className="flex flex-wrap gap-2 pt-2"><button type="button" className={buttonClass} onClick={() => startEditing(product)}>Edit</button><button type="button" className={buttonClass} onClick={() => void toggleProduct(product, "is_active")}>{product.is_active ? "Unpublish" : "Publish"}</button><button type="button" className={buttonClass} onClick={() => void deleteProduct(product)}>Delete</button></div></div></article>; })}</div>}{!filteredProducts.length && !loadingProducts && <div className={panelClass}>No products match the current filters.</div>}
      {previewProduct && <ProductPreview product={previewProduct} index={previewImageIndex} setIndex={setPreviewImageIndex} onClose={() => setPreviewProduct(null)} onEdit={() => { startEditing(previewProduct); setPreviewProduct(null); }} currency={currency} />}
    </div>;
  }

  function renderModule() {
    if (loadingModule) return <div className={panelClass}>Loading {activeTabData.label.toLowerCase()}…</div>;
    switch (activeTab) {
      case "products": return renderProducts();
      case "catalogue": return renderCategoryPanel();
      case "orders": return renderOrders();
      case "inventory": return renderInventory();
      case "staff": return renderApplications();
      case "suppliers": return renderApplications(true);
      case "marketing": return renderMarketing();
      case "support": return renderSupport();
      case "finance": return renderFinance();
      case "intelligence": return renderIntelligence();
    }
  }

  return <div className={embedded ? "space-y-5" : "min-h-screen bg-background px-3 py-6 text-foreground sm:px-5 sm:py-8"}><div className={embedded ? "space-y-5" : "mx-auto max-w-7xl space-y-6"}>{!embedded && <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{BRAND.name}</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Administration</h1><p className="mt-2 text-sm text-muted-foreground">Manage marketplace operations and records.</p></div><div className="flex gap-2"><a href="/workspace/admin" className={buttonClass}>Workspace home</a><Link to="/" className={buttonClass}>View storefront</Link></div></header>}
    {!embedded && <nav aria-label="Administration modules" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{TABS.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => setTab(tab.id)} aria-current={activeTab === tab.id ? "page" : undefined} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition ${activeTab === tab.id ? "border-gold bg-gold/10" : "border-border bg-card hover:border-gold/50"}`}><Icon className="h-5 w-5 shrink-0 text-gold" /><span><span className="block text-sm font-semibold">{tab.label}</span><span className="hidden text-[11px] text-muted-foreground sm:block">{tab.note}</span></span></button>; })}</nav>}
    {(message || errorMessage || moduleError) && <div role={errorMessage || moduleError ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${errorMessage || moduleError ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>{errorMessage || moduleError || message}</div>}
    <section className="space-y-5">{!embedded && <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><ActiveIcon className="h-5 w-5 text-gold" /><h2 className="text-lg font-semibold">{activeTabData.label}</h2></div><p className="mt-1 text-sm text-muted-foreground">{activeTabData.note}</p></div><button className={buttonClass} type="button" onClick={() => void loadModuleData(activeTab)}><RefreshCw className="mr-2 h-4 w-4" />Reload module</button></div>}{renderModule()}</section>
    </div></div>;
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="surface rounded-xl border p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold text-gold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></article>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-background p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2><button type="button" className="btn btn-outline px-3" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button></div>{children}</div></div>;
}

function ProductPreview({ product, index, setIndex, onClose, onEdit, currency }: { product: Product; index: number; setIndex: (index: number) => void; onClose: () => void; onEdit: () => void; currency: (value: number) => string }) {
  const gallery = Array.isArray(product.gallery) ? product.gallery.filter((item): item is string => typeof item === "string") : [];
  const images = gallery.length ? gallery : product.image_url ? [product.image_url] : [];
  const safeIndex = images.length ? ((index % images.length) + images.length) % images.length : 0;
  return <Modal title="Product preview" onClose={onClose}><div className="grid gap-5 lg:grid-cols-2"><div><div className="relative aspect-square overflow-hidden rounded-xl bg-muted">{images[safeIndex] ? <img src={getProductImageUrl(images[safeIndex])} alt={`${product.name} image ${safeIndex + 1}`} className="h-full w-full object-contain p-4" /> : <div className="grid h-full place-items-center"><Package className="h-20 w-20 text-gold/60" /></div>}{images.length > 1 && <><button type="button" onClick={() => setIndex(safeIndex - 1)} className="absolute left-2 top-1/2 rounded-full bg-background/90 p-2" aria-label="Previous image"><ChevronLeft /></button><button type="button" onClick={() => setIndex(safeIndex + 1)} className="absolute right-2 top-1/2 rounded-full bg-background/90 p-2" aria-label="Next image"><ChevronRight /></button><span className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-xs">{safeIndex + 1} / {images.length}</span></>}</div>{images.length > 1 && <div className="mt-2 flex gap-2 overflow-x-auto">{images.map((path, i) => <button key={`${path}-${i}`} type="button" onClick={() => setIndex(i)} className={`h-14 w-14 shrink-0 overflow-hidden rounded border ${i === safeIndex ? "border-gold" : "border-border"}`}><img src={getProductImageUrl(path)} alt="" className="h-full w-full object-cover" /></button>)}</div>}</div><section className="space-y-3"><span className="text-xs text-muted-foreground">{product.is_active ? "Published" : "Draft"} · Stock {product.stock}</span><h3 className="text-2xl font-bold">{product.name}</h3><p className="text-2xl font-bold text-gold">{currency(Number(product.price))}</p><p className="break-all text-xs text-muted-foreground">{product.slug}{product.sku ? ` · SKU ${product.sku}` : ""}</p><p className="whitespace-pre-wrap text-sm">{product.description || "No description"}</p><div className="flex gap-2"><button type="button" className="btn btn-primary" onClick={onEdit}>Edit product</button><button type="button" className="btn btn-outline" onClick={onClose}>Close</button></div></section></div></Modal>;
}
