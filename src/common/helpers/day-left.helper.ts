export function getRemainingDays(createdAt: string, validityPeriod: number): number {
  const createdDate = new Date(createdAt);
  const now = new Date();

  // soatlarni nolga tushiramiz
  createdDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  // tugash sanasi
  const expireDate = new Date(createdDate);
  expireDate.setDate(expireDate.getDate() + validityPeriod);

  const diffMs = expireDate.getTime() - now.getTime();
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(remainingDays, 0);
}
