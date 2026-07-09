import { api } from "./api";

export interface WishlistItem {
  _id: string;
  title: string;
  price?: number | null;
  url?: string | null;
  image?: string | null;
  isPurchased: boolean;
  reservedBy?: { _id: string; name: string; surname?: string } | null;
  reservedByGuest?: string | null;
}

export interface UserWishlist {
  user: { _id: string; name: string; surname?: string; avatar?: string };
  data: WishlistItem[];
}

export async function fetchUserWishlist(userId: string): Promise<UserWishlist> {
  return api<UserWishlist>(`/wishlist/user/${userId}`);
}

export async function reserveItem(itemId: string): Promise<void> {
  await api(`/wishlist/${itemId}/reserve`, { method: "POST" });
}

export async function unreserveItem(itemId: string): Promise<void> {
  await api(`/wishlist/${itemId}/unreserve`, { method: "POST" });
}

// ---- Partage public de la wishlist ----

export interface WishlistSettings {
  isPublic: boolean;
  publicSlug: string | null;
  friendCode: string | null;
  publicUrl: string | null;
}

export async function fetchWishlistSettings(): Promise<WishlistSettings> {
  return api<WishlistSettings>("/wishlist/settings");
}

export async function toggleWishlistPublic(): Promise<WishlistSettings> {
  return api<WishlistSettings>("/wishlist/settings/toggle", { method: "PATCH" });
}

export async function setWishlistFriendCode(
  action: "generate" | "remove",
): Promise<{ friendCode: string | null }> {
  return api<{ friendCode: string | null }>("/wishlist/settings/friendcode", {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

// ---- Ma wishlist ----

export async function fetchMyWishlist(): Promise<WishlistItem[]> {
  const { data } = await api<{ data: WishlistItem[] }>("/wishlist");
  return data;
}

export async function addWishlistItem(item: {
  title: string;
  price?: number;
  url?: string;
  description?: string;
  image?: string;
}): Promise<void> {
  await api("/wishlist", { method: "POST", body: JSON.stringify(item) });
}

// ---- Récupération auto des infos produit depuis un lien ----

export interface UrlInfo {
  success: boolean;
  blocked?: boolean;
  message?: string;
  data: {
    title: string | null;
    description: string | null;
    image: string | null;
    price: number | null;
    currency: string;
  } | null;
  affiliateUrl?: string;
}

/**
 * POST /wishlist/fetch-url — scrape Open Graph côté serveur.
 * Amazon/Fnac/Micromania bloquent le scraping : success=false + blocked=true,
 * mais affiliateUrl est toujours renvoyée (lien affilié Amazon).
 */
export async function fetchUrlInfo(url: string): Promise<UrlInfo> {
  return api<UrlInfo>("/wishlist/fetch-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function deleteWishlistItem(id: string): Promise<void> {
  await api(`/wishlist/${id}`, { method: "DELETE" });
}
