import { describe, expect, it } from 'vitest';
import {
  applyScan,
  guessBookingKind,
  parseBoardingPass,
  scanBooking,
  type ScanTarget,
} from './bookingScan';

/** 여행 시작일 — 연도 없는 날짜("11월 3일", "03NOV")의 기준 */
const REF = '2026-11-01';

const empty: ScanTarget = {
  flightNo: '',
  provider: '',
  from: '',
  to: '',
  title: '',
  phone: '',
  address: '',
  seat: '',
  roomType: '',
  partySize: '',
  confirmationNo: '',
  startDate: REF,
  endDate: '',
  startTime: '',
  endTime: '',
};

/** 새 예약 화면에서 캡처 글로 채운 칸 */
const fill = (kind: string, lines: string[]) => {
  const text = lines.join('\n');
  // 사진만 보고도 이 종류로 알아본다 (사용자 요청 2026-11-24 "항공권이면 항공 탭으로")
  expect(guessBookingKind(text)).toBe(kind);
  return applyScan(kind, scanBooking(text, { kind, ref: REF }), empty, true).patch;
};

/*
 * 아래 글은 실제 예약 확인 화면을 글자 인식(같은 높이 글자는 한 줄로 묶임)으로 읽었을 때의 모양을 본떠 만든 것.
 * 이름·번호는 지어낸 값
 */
describe('항공권 캡처', () => {
  it('대한항공 전자항공권 확인증 — 항공권 번호·발권일은 건너뛴다', () => {
    expect(
      fill('flight', [
        '대한항공 전자항공권 확인증',
        '승객 성명 HONG/GILDONG MR',
        '예약번호 AB12CD   항공권 번호 180-2412345678',
        '여정',
        '편명 KE703  2026년 11월 3일(화)',
        '출발 인천 ICN 09:00 터미널 2',
        '도착 도쿄/나리타 NRT 11:20 터미널 1',
        '좌석 34A  수하물 23kg',
        '발권일 2026년 10월 20일',
      ]),
    ).toEqual({
      confirmationNo: 'AB12CD',
      flightNo: 'KE703',
      provider: '대한항공',
      from: 'ICN',
      to: 'NRT',
      seat: '34A',
      startDate: '2026-11-03',
      endDate: '2026-11-03',
      startTime: '09:00',
      endTime: '11:20',
    });
  });

  it('제주항공 왕복 — 가는 편만, "제주항공"은 제주공항이 아님', () => {
    expect(
      fill('flight', [
        '제주항공 예약 확인',
        '예약번호 Z7K9PQ',
        '가는 편 7C1101',
        '2026.11.03 (화)',
        '08:05            10:25',
        '인천(ICN)    →   후쿠오카(FUK)',
        '오는 편 7C1102',
        '2026.11.06 (금)',
        '11:35            13:00',
        '후쿠오카(FUK) → 인천(ICN)',
      ]),
    ).toEqual({
      confirmationNo: 'Z7K9PQ',
      flightNo: '7C1101',
      provider: '제주항공',
      from: 'ICN',
      to: 'FUK',
      startDate: '2026-11-03',
      endDate: '2026-11-03',
      startTime: '08:05',
      endTime: '10:25',
    });
  });

  it('모바일 탑승권 — 탑승 시작 시각이 아니라 출발 시각, 연도 없는 03NOV', () => {
    expect(
      fill('flight', [
        'ASIANA AIRLINES  BOARDING PASS',
        'NAME KIM/MINJI',
        'FLIGHT OZ102   DATE 03NOV',
        'FROM SEOUL/INCHEON ICN   TO TOKYO/NARITA NRT',
        'BOARDING TIME 08:20  GATE 112  SEAT 32K',
        'DEPARTURE 09:00',
      ]),
    ).toMatchObject({
      flightNo: 'OZ102',
      from: 'ICN',
      to: 'NRT',
      seat: '32K',
      startDate: '2026-11-03',
      startTime: '09:00',
    });
  });

  it('Trip.com 영어 왕복 — 항공사 예약번호(PNR), 공항은 영어 이름으로도', () => {
    expect(
      fill('flight', [
        'Trip.com Flight Booking Confirmed',
        'Booking No. 1128834455667',
        'Airline Booking Reference (PNR): XY7Z8W',
        'Depart  Tue, Nov 3, 2026',
        'TW 211  Seoul Incheon 10:30 → Osaka Kansai 12:20',
        'Return  Fri, Nov 6, 2026',
        'TW 212  Osaka Kansai 13:30 → Seoul Incheon 15:20',
      ]),
    ).toEqual({
      confirmationNo: 'XY7Z8W',
      flightNo: 'TW211',
      provider: '티웨이항공',
      from: 'ICN',
      to: 'KIX',
      startDate: '2026-11-03',
      endDate: '2026-11-03',
      startTime: '10:30',
      endTime: '12:20',
    });
  });

  it('여행사 예약번호보다 항공사 예약번호, 한국어 공항 이름', () => {
    expect(
      fill('flight', [
        '인터파크 항공권 예약 완료',
        '예약번호 2411241234',
        '항공사 예약번호 KQ5RT2',
        '티웨이항공 TW301',
        '11월 3일(화) 07:30 김포 → 11월 3일(화) 09:40 하네다',
      ]),
    ).toMatchObject({
      confirmationNo: 'KQ5RT2',
      flightNo: 'TW301',
      from: 'GMP',
      to: 'HND',
      startDate: '2026-11-03',
      startTime: '07:30',
      endTime: '09:40',
    });
  });

  it('밤 비행기 — 도착 시각이 더 이르면 다음 날 도착', () => {
    expect(
      fill('flight', ['KE 657', '2026-11-03', '인천 ICN 19:20 → 방콕 BKK 23:10', 'BKK 23:10']),
    ).toMatchObject({ startDate: '2026-11-03', endDate: '2026-11-03' });
    expect(fill('flight', ['KE 652', '2026-11-08', 'BKK 23:45 → ICN 07:15'])).toMatchObject({
      startDate: '2026-11-08',
      endDate: '2026-11-09',
      startTime: '23:45',
      endTime: '07:15',
    });
  });
});

describe('숙소 캡처', () => {
  it('아고다 — 체크인·체크아웃이 두 칸으로 나란히, 결제일·취소 기한은 건너뛴다', () => {
    expect(
      fill('lodging', [
        '아고다 예약 확인서',
        '예약 ID: 1234567890',
        '호텔 그레이서리 신주쿠',
        '주소: 1-19-1 Kabukicho, Shinjuku-ku, Tokyo 160-8466',
        '체크인            체크아웃',
        '2026년 11월 3일 (화)   2026년 11월 6일 (금)',
        '15:00 이후        11:00 이전',
        '객실 타입: 스탠다드 더블룸',
        '투숙객 2명',
        '결제 완료 2026년 10월 1일',
        '무료 취소 기한: 2026년 10월 30일',
      ]),
    ).toEqual({
      confirmationNo: '1234567890',
      title: '호텔 그레이서리 신주쿠',
      address: '1-19-1 Kabukicho, Shinjuku-ku, Tokyo 160-8466',
      roomType: '스탠다드 더블룸',
      startDate: '2026-11-03',
      endDate: '2026-11-06',
      startTime: '15:00',
      endTime: '11:00',
    });
  });

  it('Booking.com 앱 — 칸 이름 아래 줄에 값, 연도 없는 날짜, 점으로 나눈 예약 번호', () => {
    expect(
      fill('lodging', [
        '예약이 확정되었습니다',
        'Hotel Nikko Kansai Airport',
        '예약 번호: 4821.553.190',
        'PIN 코드: 1234',
        '체크인',
        '11월 3일 (화)',
        '15:00부터',
        '체크아웃',
        '11월 5일 (목)',
        '11:00까지',
        '전화: +81 72-455-1111',
      ]),
    ).toEqual({
      confirmationNo: '4821553190',
      title: 'Hotel Nikko Kansai Airport',
      phone: '+81 72-455-1111',
      startDate: '2026-11-03',
      endDate: '2026-11-05',
      startTime: '15:00',
      endTime: '11:00',
    });
  });

  it('야놀자 — 입실·퇴실, 11.03(화), 예약자 전화번호는 숙소 연락처가 아님', () => {
    const p = fill('lodging', [
      '야놀자 예약내역',
      '예약번호 2411240123456',
      '신라스테이 해운대',
      '입실 11.03(화) 15:00',
      '퇴실 11.04(수) 11:00',
      '객실정보: 디럭스 더블 (오션뷰)',
      '예약자 홍길동 / 010-1234-5678',
    ]);
    expect(p).toEqual({
      confirmationNo: '2411240123456',
      title: '신라스테이 해운대',
      roomType: '디럭스 더블 (오션뷰)',
      startDate: '2026-11-03',
      endDate: '2026-11-04',
      startTime: '15:00',
      endTime: '11:00',
    });
  });

  it('에어비앤비 — 오후 4:00, 확인 코드, 주소는 다음 줄', () => {
    expect(
      fill('lodging', [
        '에어비앤비 예약 확정',
        '시부야 근처 아늑한 아파트',
        '체크인 2026년 11월 3일 (화) 오후 4:00',
        '체크아웃 2026년 11월 7일 (토) 오전 10:00',
        '게스트 3명',
        '확인 코드 HMXK4Q2R9P',
        '주소',
        '2-chome-5 Dogenzaka, Shibuya City, Tokyo',
      ]),
    ).toEqual({
      confirmationNo: 'HMXK4Q2R9P',
      title: '시부야 근처 아늑한 아파트',
      address: '2-chome-5 Dogenzaka, Shibuya City, Tokyo',
      startDate: '2026-11-03',
      endDate: '2026-11-07',
      startTime: '16:00',
      endTime: '10:00',
    });
  });

  it('호텔스닷컴 영어 — 3:00 PM, Itinerary number, Room:', () => {
    expect(
      fill('lodging', [
        'Your booking is confirmed',
        'Itinerary number: 7301234567890',
        'Shilla Stay Seoul Station',
        'Check-in: Tue, Nov 3, 2026 (3:00 PM)',
        'Check-out: Fri, Nov 6, 2026 (11:00 AM)',
        'Room: Standard Double Room',
        '2 adults',
        'Tel: +82 2-2230-0700',
      ]),
    ).toEqual({
      confirmationNo: '7301234567890',
      title: 'Shilla Stay Seoul Station',
      phone: '+82 2-2230-0700',
      roomType: 'Standard Double Room',
      startDate: '2026-11-03',
      endDate: '2026-11-06',
      startTime: '15:00',
      endTime: '11:00',
    });
  });

  it('일본 숙소 사이트 — 전각 쌍점, 年月日', () => {
    expect(
      fill('lodging', [
        '予約番号：0A1B2C3D',
        'ホテルグレイスリー那覇',
        'チェックイン：2026年11月3日 15:00',
        'チェックアウト：2026年11月5日 11:00',
      ]),
    ).toEqual({
      confirmationNo: '0A1B2C3D',
      title: 'ホテルグレイスリー那覇',
      startDate: '2026-11-03',
      endDate: '2026-11-05',
      startTime: '15:00',
      endTime: '11:00',
    });
  });
});

describe('그 밖의 예약 캡처', () => {
  it('코레일 승차권 — 출발 시각, 승차권 번호', () => {
    expect(
      fill('train', [
        '코레일톡 승차권',
        '2026년 11월 3일 (화)',
        'KTX 023  서울 08:00 → 부산 10:39',
        '4호차 12A',
        '승차권 번호 12345-1103-12345-67',
      ]),
    ).toEqual({
      confirmationNo: '12345-1103-12345-67',
      startDate: '2026-11-03',
      startTime: '08:00',
    });
  });

  it('클룩 입장권 — 상품명·이용일·인원·바우처 번호', () => {
    expect(
      fill('ticket', [
        'Klook 바우처',
        '상품명: 도쿄 디즈니랜드 1일 입장권',
        '이용일: 2026년 11월 4일 (수)',
        '인원: 성인 2',
        '바우처 번호: KLK-88231457',
      ]),
    ).toEqual({
      confirmationNo: 'KLK-88231457',
      title: '도쿄 디즈니랜드 1일 입장권',
      partySize: '2',
      startDate: '2026-11-04',
    });
  });

  it('식당 예약 — "예약 일시"가 방문 시각, 오후 7:30, 매장 전화', () => {
    expect(
      fill('restaurant', [
        '캐치테이블 예약 확정',
        '스시 사이토',
        '예약 일시 2026.11.04 (수) 오후 7:30',
        '인원 2명',
        '매장 전화 03-3589-4412',
      ]),
    ).toEqual({
      partySize: '2',
      phone: '03-3589-4412',
      startDate: '2026-11-04',
      startTime: '19:30',
    });
  });

  it('렌터카 — 픽업·반납 날짜와 시각', () => {
    expect(
      fill('car', [
        'Rentalcars.com 예약 확인',
        '예약 번호: 638412907',
        '픽업  2026년 11월 3일 10:00  나하 공항',
        '반납  2026년 11월 6일 18:00  나하 공항',
      ]),
    ).toEqual({
      confirmationNo: '638412907',
      startDate: '2026-11-03',
      startTime: '10:00',
      endDate: '2026-11-06',
      endTime: '18:00',
    });
  });
});

describe('글 나누기 세부', () => {
  it('12시간제·시 표기', () => {
    const r = scanBooking(
      ['12:00 PM', '12 AM', '오전 12시', '오후 3시 30분', '2시간', '15時'].join('\n'),
      {
        ref: REF,
      },
    );
    expect(r.times).toEqual(['12:00', '00:00', '15:30', '15:00']);
  });
  it('글자 인식이 띄어 읽은 시각 ("09 : 00")', () => {
    expect(scanBooking('출발 09 : 00').times).toEqual(['09:00']);
  });
  it('금액·전화번호는 날짜·시각이 아니다', () => {
    const r = scanBooking('합계 ₩1,234,000\n+82 2-123-4567\nRoom 1203', { ref: REF });
    expect(r.dates).toEqual([]);
    expect(r.times).toEqual([]);
  });
  it('터미널·게이트는 편명이 아니고, 모르는 항공사 코드는 편명 글자 뒤에서만', () => {
    expect(scanBooking('T2 267 게이트\nFlight: XQ 102').flightNo).toBe('XQ102');
    expect(scanBooking('AB 1234 블록').flightNo).toBeUndefined();
  });
  it('12월에 받은 1월 예약은 다음 해', () => {
    expect(scanBooking('1월 5일', { ref: '2026-12-20' }).dates).toEqual(['2027-01-05']);
  });
  it('칸 이름이 값 뒤에 오는 줄 ("09:00 출발 11:20 도착")', () => {
    expect(fill('flight', ['LJ 201', '2026년 11월 3일 09:00 출발 11:20 도착'])).toMatchObject({
      startDate: '2026-11-03',
      startTime: '09:00',
      endTime: '11:20',
    });
  });
  it('없는 날짜는 버린다', () => {
    expect(scanBooking('2026-02-30').dates).toEqual([]);
  });
  it('종류를 알 수 없으면 undefined (지금 고른 종류 그대로)', () => {
    expect(guessBookingKind('안녕하세요\n2026-11-03')).toBeUndefined();
  });
  it('항공권 안의 "온라인 체크인" 안내는 숙소가 아님', () => {
    expect(
      guessBookingKind('KE703 ICN → NRT\n온라인 체크인은 출발 24시간 전부터\n수하물 23kg'),
    ).toBe('flight');
  });
  it('못 찾으면 비워 둔다', () => {
    expect(scanBooking('안녕하세요')).toEqual({ airports: [], dates: [], times: [] });
  });
});

describe('탑승권 바코드 (IATA BCBP)', () => {
  const raw = 'M1HONG/GILDONG MR     EAB12CD ICNNRTKE 0703 307Y034A0045 100';
  it('편명·공항·날짜·예약번호·좌석 (연도는 기준일에 가까운 해)', () => {
    expect(parseBoardingPass(raw, REF)).toEqual({
      flightNo: 'KE703',
      provider: '대한항공',
      airports: ['ICN', 'NRT'],
      dates: ['2026-11-03'],
      times: [],
      start: { date: '2026-11-03' },
      confirmationNo: 'AB12CD',
      seat: '34A',
    });
    // 1월 초 여행에 12월 말 탑승권
    expect(parseBoardingPass(raw.replace(' 307', ' 360'), '2027-01-02')?.dates).toEqual([
      '2026-12-26',
    ]);
  });
  it('탑승권이 아닌 바코드는 무시', () => {
    expect(parseBoardingPass('https://example.com/qr', REF)).toBeUndefined();
    expect(parseBoardingPass('M1SHORT', REF)).toBeUndefined();
  });
  it('바코드 값으로 칸 채우기 — 시각은 비워 둔다 (편명 불러오기로)', () => {
    const scan = parseBoardingPass(raw, REF)!;
    expect(applyScan('flight', scan, empty, true).patch).toEqual({
      confirmationNo: 'AB12CD',
      flightNo: 'KE703',
      provider: '대한항공',
      from: 'ICN',
      to: 'NRT',
      seat: '34A',
      startDate: '2026-11-03',
      endDate: '2026-11-03',
    });
  });
});

describe('캡처 → 예약 칸', () => {
  it('글자 칸은 빈 칸만', () => {
    const scan = scanBooking('예약번호 AB12CD\nKE703 ICN NRT\n2026-11-03 09:00 11:20', {
      kind: 'flight',
      ref: REF,
    });
    const { patch, filled } = applyScan(
      'flight',
      scan,
      { ...empty, flightNo: 'KE001', provider: '대한항공' },
      true,
    );
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
    const scan = scanBooking('2026-11-03 ~ 2026-11-06', { kind: 'lodging', ref: REF });
    const { patch } = applyScan('lodging', scan, { ...empty, endDate: '2026-11-04' }, false);
    expect(patch).toEqual({});
  });
});
