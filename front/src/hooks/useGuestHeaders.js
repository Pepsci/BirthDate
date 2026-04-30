import { useMemo } from "react";

/**
 * Retourne un objet { headers } à passer dans les appels apiHandler
 * si un guestToken est présent pour cet event.
 * Pour les users connectés, retourne {} (le cookie JWT suffit).
 */
const useGuestHeaders = (shortId) => {
  return useMemo(() => {
    const token = localStorage.getItem(`guestToken_${shortId}`);
    if (!token) return {};
    return { headers: { "x-guest-token": token } };
  }, [shortId]);
};

export default useGuestHeaders;
