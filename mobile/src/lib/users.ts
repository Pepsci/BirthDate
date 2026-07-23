import { api, API_URL, getToken, setToken, AuthUser } from "./api";

export interface UserProfile extends AuthUser {
  birthDate?: string | null;
  nameday?: string | null; // "MM-DD"
  avatar?: string | null;
  receiveBirthdayEmails?: boolean;
  receiveOwnBirthdayEmail?: boolean;
  receiveFriendRequestEmails?: boolean;
  monthlyRecap?: boolean;
  receiveEventEmails?: boolean;
  receiveChatEmails?: boolean;
  pushEnabled?: boolean;
  pushEvents?: {
    birthdays?: boolean;
    chat?: boolean;
    friends?: boolean;
    gifts?: boolean;
    events?: boolean;
  };
}

export async function fetchMe(): Promise<UserProfile> {
  return api<UserProfile>("/users/me");
}

/**
 * PATCH /users/me (JSON) — renvoie { payload, authToken } :
 * le back re-signe un token avec les nouvelles infos, on le re-stocke.
 */
export async function updateMe(
  fields: Record<string, unknown>,
): Promise<UserProfile> {
  const { payload, authToken } = await api<{
    payload: UserProfile;
    authToken: string;
  }>("/users/me", { method: "PATCH", body: JSON.stringify(fields) });
  if (authToken) await setToken(authToken);
  return payload;
}

/** PATCH /users/me en multipart pour l'avatar (champ "avatar") */
export async function updateAvatar(imageUri: string): Promise<UserProfile> {
  const token = await getToken();
  const form = new FormData();
  const name = imageUri.split("/").pop() ?? "avatar.jpg";
  const ext = name.split(".").pop()?.toLowerCase() ?? "jpg";
  form.append("avatar", {
    uri: imageUri,
    name,
    type: `image/${ext === "jpg" ? "jpeg" : ext}`,
  } as unknown as Blob);

  const res = await fetch(`${API_URL}/api/users/me`, {
    method: "PATCH",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? `Erreur ${res.status}`);
  if (data.authToken) await setToken(data.authToken);
  return data.payload;
}

/**
 * Supprime la photo de profil → le back remet l'avatar DiceBear par défaut.
 * Passe par updateMe (PATCH JSON) : le back lit `removeAvatar === "true"`.
 */
export async function removeAvatar(): Promise<UserProfile> {
  return updateMe({ removeAvatar: "true" });
}

export async function deleteAccount(userId: string): Promise<void> {
  await api(`/users/${userId}`, { method: "DELETE" });
}
