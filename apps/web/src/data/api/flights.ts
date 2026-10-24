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

export const flightsApi = {
  lookup: (flightNo: string) =>
    api<FlightInfo>(`/api/flights/${encodeURIComponent(flightNo.replace(/\s+/g, ''))}`),
};
