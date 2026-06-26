// Frais Stripe France carte européenne standard : 1,5 % + 0,25 € PAR transaction.
// Le fixe (0,25 €) s'applique à CHAQUE contribution, pas une seule fois sur le total.
// Tout est en centimes.
const FEE_PERCENT = 0.015;
const FEE_FIXED = 25; // 25 centimes

// Frais pour une contribution unique (centimes)
export const feeForContribution = (amountCents) =>
  Math.round(amountCents * FEE_PERCENT) + FEE_FIXED;

// Frais totaux pour un tableau de contributions [{ amount }] (centimes)
export const totalFees = (contributions = []) =>
  contributions.reduce((sum, c) => sum + feeForContribution(c.amount), 0);

// Net estimé = total collecté - frais totaux (centimes)
export const netEstimate = (contributions = []) => {
  const gross = contributions.reduce((sum, c) => sum + c.amount, 0);
  return gross - totalFees(contributions);
};

export const euro = (cents) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
