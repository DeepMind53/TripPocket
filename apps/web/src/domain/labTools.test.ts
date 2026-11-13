import { describe, expect, it } from 'vitest';
import {
  convertUnit,
  icsText,
  parseBulkLines,
  parseMapLink,
  shiftPatches,
  splitShare,
} from './labTools';

describe('실험 3차 계산 (2026-11-13)', () => {
  it('여러 일정 붙여 넣기: 시각 모양 여러 가지, 목록 기호는 뗀다', () => {
    expect(
      parseBulkLines(
        '- 10:00 센소지\n\n2. 11:30~13:00 아메요코\n9시 30분 츠키지\n스카이트리\n25:00 이상',
      ),
    ).toEqual([
      { title: '센소지', startTime: '10:00' },
      { title: '아메요코', startTime: '11:30', endTime: '13:00' },
      { title: '츠키지', startTime: '09:30' },
      { title: '스카이트리' },
      { title: '25:00 이상' },
    ]);
    expect(parseBulkLines(Array(40).fill('a').join('\n'))).toHaveLength(30);
  });

  it('미루기: 예약·시각 없는 일정은 그대로, 자정을 넘으면 건너뜀', () => {
    const r = shiftPatches(
      [
        { id: 'a', kind: 'place', startTime: '10:00', endTime: '11:00' },
        { id: 'b', kind: 'place' },
        { id: 'c', kind: 'transport', startTime: '12:00', bookingId: 'x' },
        { id: 'd', kind: 'place', startTime: '23:40' },
        { id: 'e', kind: 'place', startTime: '08:00' },
      ],
      30,
      '09:00',
    );
    expect(r.patches).toEqual([{ id: 'a', startTime: '10:30', endTime: '11:30' }]);
    expect(r.skipped).toBe(1);
  });

  it('캘린더 파일: 시간대·종일·이스케이프', () => {
    const ics = icsText(
      { title: '도쿄, 가을', timezone: 'Asia/Tokyo' },
      [
        { id: 'a', date: '2026-11-03', kind: 'place', title: '센소지', startTime: '10:00' },
        { id: 'b', date: '2026-11-04', kind: 'place', title: '하루 자유' },
        { id: 'c', date: '2026-11-04', kind: 'note', title: '메모' },
        { id: 'd', date: null, kind: 'place', title: '가고 싶은 곳' },
      ],
      new Date('2026-11-01T00:00:00Z'),
    );
    expect(ics).toContain('X-WR-CALNAME:도쿄\\, 가을');
    expect(ics).toContain('DTSTART;TZID=Asia/Tokyo:20261103T100000\r\n');
    expect(ics).toContain('DTEND;TZID=Asia/Tokyo:20261103T110000\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261104\r\nDTEND;VALUE=DATE:20261105');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it('지도 링크: 구글 핀·@좌표·q=, 네이버, 짧은 링크는 null', () => {
    expect(
      parseMapLink(
        'https://www.google.com/maps/place/Senso-ji/@35.7147,139.7966,17z/data=!3m1!4b1!4m6!3m5!3d35.7148!4d139.7967',
      ),
    ).toEqual({ lat: 35.7148, lng: 139.7967, name: 'Senso-ji' });
    expect(parseMapLink('https://maps.google.com/?q=34.6687,135.5013')).toEqual({
      lat: 34.6687,
      lng: 135.5013,
    });
    expect(parseMapLink('https://map.naver.com/p?c=126.9780,37.5665,15,0,0,0,dh')).toEqual({
      lat: 37.5665,
      lng: 126.978,
    });
    expect(parseMapLink('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(parseMapLink('센소지')).toBeNull();
  });

  it('나눠 내기·단위 바꾸기', () => {
    expect(splitShare(100, 3, 0)).toBe(34);
    expect(splitShare(10, 4, 2)).toBe(2.5);
    expect(convertUnit('temp', 77, 'toMetric')).toBe(25);
    expect(convertUnit('temp', 0, 'fromMetric')).toBe(32);
    expect(convertUnit('length', 1, 'toMetric')).toBe(1.61);
    expect(convertUnit('weight', 1, 'fromMetric')).toBe(2.2);
    expect(convertUnit('height', 10, 'toMetric')).toBe(25.4);
  });
});
