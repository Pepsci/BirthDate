import { api, API_URL, getToken, setToken, AuthUser } from "./api";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";

export interface UserProfile extends AuthUser {
  birthDate?: string | null;
  nameday?: string | null; // "MM-DD"
  avatar?: string | null;
  receiveBirthdayEmails?: boolean;
  receiveOwnBirthdayEmail?: boolean;
  receiveFriendRequestEmails?: boolean;
  monthlyRecap?: boolean;
  hideNamedaysOnCards?: boolean;
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

/**
 * PATCH /users/me en multipart pour l'avatar (champ "avatar").
 *
 * On passe par `uploadAsync` d'expo-file-system plutôt que par FormData + fetch :
 * sur iOS, l'encodage multipart de fetch en RN n'était pas reçu par multer
 * (`req.file` restait vide côté serveur). uploadAsync lit le fichier nativement
 * et construit un multipart standard que multer parse correctement.
 */
export async function updateAvatar(imageUri: string): Promise<UserProfile> {
  const token = await getToken();

  const res = await uploadAsync(`${API_URL}/api/users/me`, imageUri, {
    httpMethod: "PATCH",
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: "avatar",
    mimeType: "image/jpeg",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const data = res.body ? JSON.parse(res.body) : {};
  if (res.status < 200 || res.status >= 300) {
    throw new Error(data?.message ?? `Erreur ${res.status}`);
  }
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
