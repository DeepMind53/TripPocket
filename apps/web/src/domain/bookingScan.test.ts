import { describe, expect, it } from 'vitest';
import { applyScan, scanBooking } from './bookingScan';

describe('예약 확인 캡처 글 나누기', () => {
  it('항공권: 예약번호·편명·공항·날짜·시각', () => {
    const r = scanBooking(
      [
        '대한항공 e-티켓 확인증',
        '예약번호: AB12CD',
        'KE 703 인천(ICN) → 도쿄/나리타(NRT)',
        '2026년 11월 3일 09:00 출발 11:20 도착',
      ].join('\n'),
    );
    expect(r).toMatchObject({
      confirmationNo: 'AB12CD',
      flightNo: 'KE703',
      airports: ['ICN', 'NRT'],
      dates: ['2026-11-03'],
      times: ['09:00', '11:20'],
    });
  });
  it('영어 숙소 확인서: 이름·체크인·체크아웃·전화', () => {
    const r = scanBooking(
      [
        'Booking confirmation',
        'Hotel: Hotel Gracery Shinjuku',
        'Check-in: Tue, Nov 3, 2026 from 14:00',
        'Check-out: 6 Nov 2026 until 11:00',
        'Confirmation number: 4821 553 190',
        'Phone: +81 3-6833-1111',
      ].join('\n'),
    );
    expect(r.name).toBe('Hotel Gracery Shinjuku');
    expect(r.dates).toEqual(['2026-11-03', '2026-11-06']);
    expect(r.times).toEqual(['14:00', '11:00']);
    expect(r.confirmationNo).toBe('4821553190');
    expect(r.phone).toBe('+81 3-6833-1111');
  });
  it('터미널·게이트는 편명이 아니고, 글자가 섞인 예약번호는 통째로', () => {
    const r = scanBooking('T2 267 게이트\nFlight: OZ 102\nBooking reference: 123ABC');
    expect(r.flightNo).toBe('OZ102');
    expect(r.confirmationNo).toBe('123ABC');
  });
  it('못 찾으면 비워 둔다', () => {
    expect(scanBooking('안녕하세요')).toEqual({ airports: [], dates: [], times: [] });
  });
});

describe('캡처 → 예약 칸', () => {
  const empty = {
    flightNo: '',
    from: '',
    to: '',
    title: '',
    phone: '',
    confirmationNo: '',
    startDate: '2026-11-01',
    endDate: '',
    startTime: '',
    endTime: '',
  };
  it('새 항공 예약: 날짜는 초기값을 바꾸고, 글자 칸은 빈 칸만', () => {
    const scan = scanBooking('예약번호 AB12CD\nKE703 ICN NRT\n2026-11-03 09:00 11:20');
    const { patch, filled } = applyScan('flight', scan, { ...empty, flightNo: 'KE001' }, true);
    expect(patch).toEqual({
      confirmationNo: 'AB12CD',
      from: 'ICN',
      to: 'NRT',
      startDate: '2026-11-03',
      endDate: '2026-11-03',
      startTime: '09:00',
      endTime: '11:20',
    });
    expect(filled).toBe(7);
  });
  it('고치는 예약은 이미 있는 날짜를 그대로', () => {
    const scan = scanBooking('2026-11-03 ~ 2026-11-06');
    const { patch } = applyScan('lodging', scan, { ...empty, endDate: '2026-11-04' }, false);
    expect(patch).toEqual({});
  });
});
