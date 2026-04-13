import type { RiskDetail, RiskStatusResponse } from '../types';

export function unwrapRiskResponse(payload: RiskDetail | RiskStatusResponse | null | undefined): RiskDetail | null {
  if (!payload) return null;
  if ('latest_risk' in payload) {
    return payload.latest_risk ?? null;
  }
  return payload;
}
