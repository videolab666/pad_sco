export function isMatchOnCourt(match: any, courtNumber: number): boolean {
  if (!match || !Number.isFinite(courtNumber)) return false
  const matchCourtNumber = Number(match.courtNumber)
  return Number.isFinite(matchCourtNumber) && matchCourtNumber === courtNumber
}
