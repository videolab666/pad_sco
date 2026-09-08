export function appliedOperationIdsOf(match: any): string[] {
  if (!Array.isArray(match?.appliedOperationIds)) return []
  return match.appliedOperationIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
}

export function hasAppliedOperationId(match: any, operationId: string | undefined): boolean {
  return Boolean(operationId && appliedOperationIdsOf(match).includes(operationId))
}

/** Record an id in the same JSON row as the mutation itself. */
export function recordAppliedOperationId(match: any, operationId: string | undefined): any {
  if (!operationId) return match
  const ids = appliedOperationIdsOf(match)
  if (ids.includes(operationId)) return match
  // A phone may retry a lost ACK after hundreds of points on another device.
  match.appliedOperationIds = [...ids, operationId]
  return match
}
