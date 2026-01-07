export function getRemainingDays(createdAt: string, validityPeriod: number): number {
  const createdDate = new Date(createdAt);
  const now = new Date();

  // tugash sanasi
  const expireDate = new Date(createdDate);
  expireDate.setDate(expireDate.getDate() + validityPeriod);

  // millisekund farqi
  const diffMs = expireDate.getTime() - now.getTime();

  // kunlarga o‘tkazamiz
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // minus chiqib ketmasligi uchun
  return Math.max(remainingDays, 0);
}
