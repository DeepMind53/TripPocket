import { api } from './client';

/** 편명으로 항공편 불러오기 (서버 routes/flights.ts — AviationStack 무료, 최근 운항 기준) */
export interface FlightPoint {
  iata?: string;
  terminal?: string;
  time?: string;
}
export interface FlightInfo {
  flightNo: string;
  airline?: string;
  from: FlightPoint;
  to: FlightPoint;
}

/** 국내 공항 한쪽 정보 (공공데이터포털 — 인천은 체크인 카운터까지, 김포 등은 게이트까지) */
export interface AirportSide {
  airport: string;
  terminal?: string;
  counter?: string;
  gate?: string;
  carousel?: string;
  exit?: string;
  scheduled?: string;
  estimated?: string;
  status?: string;
}
/** info = 받은 정보(null = 그 편을 못 찾음), from = 이 날짜부터 확인 가능 */
export type AirportResult = { info?: AirportSide | null; from?: string } | null;
export interface AirportReport {
  checkedAt: string;
  dep: AirportResult;
  arr: AirportResult;
}

export const flightsApi = {
  lookup: (flightNo: string) =>
    api<FlightInfo>(`/api/flights/${encodeURIComponent(flightNo.replace(/\s+/g, ''))}`),
  airport: (
    flightNo: string,
    q: { date: string; from?: string; to?: string; arrDate?: string },
  ) => {
    const p = new URLSearchParams({ date: q.date });
    if (q.from) p.set('from', q.from);
    if (q.to) p.set('to', q.to);
    if (q.arrDate) p.set('arrDate', q.arrDate);
    return api<AirportReport>(
      `/api/flights/${encodeURIComponent(flightNo.replace(/\s+/g, ''))}/airport?${p}`,
    );
  },
};
