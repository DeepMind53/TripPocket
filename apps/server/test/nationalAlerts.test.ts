import { parsePoints } from '../src/routes/alerts';
import {
  dataGoKrOk,
  jmaStations,
  parseCwa,
  parseJma,
  parseKma,
  parseNws,
} from '../src/services/nationalAlerts';

describe('나라 기상청 특보 읽기', () => {
  it('한국 기상청: 발효 중 특보 줄마다 하나, 경보는 주황(태풍·호우·대설은 빨강)', () => {
    const out = parseKma({
      response: {
        header: { resultCode: '00' },
        body: {
          items: {
            item: [
              {
                t6: 'o 강풍주의보 : 서해5도, 인천(옹진)\r\no 호우경보 : 제주도(제주도산지)\r\no 풍랑경보 : 남해동부먼바다',
              },
            ],
          },
        },
      },
    });
    expect(out.map((a) => [a.title, a.level, a.area])).toEqual([
      ['강풍주의보', 'info', '서해5도, 인천(옹진)'],
      ['호우경보', 'red', '제주도(제주도산지)'],
      ['풍랑경보', 'orange', '남해동부먼바다'],
    ]);
  });

  it('공공데이터포털 키 만료(31)·미등록(30)은 실패로, 자료 없음(03)은 정상', () => {
    expect(() => dataGoKrOk('31')).toThrow();
    expect(() => dataGoKrOk('30')).toThrow();
    expect(() => dataGoKrOk('03')).not.toThrow();
    expect(() => dataGoKrOk('0')).not.toThrow();
    expect(parseKma({ response: { header: { resultCode: '03' } } })).toEqual([]);
  });

  it('대만: 같은 특보끼리 지역을 묶는다', () => {
    const hz = (p: string) => ({
      info: { phenomena: p, significance: '特報' },
      validTime: { startTime: '2026-10-27 04:35:00', endTime: '2026-10-27 23:00:00' },
    });
    const out = parseCwa({
      records: {
        location: [
          { locationName: '屏東縣', hazardConditions: { hazards: [hz('陸上強風')] } },
          { locationName: '臺東縣', hazardConditions: { hazards: [hz('陸上強風')] } },
          { locationName: '臺北市', hazardConditions: { hazards: [] } },
        ],
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      title: '陸上強風特報',
      area: '屏東縣, 臺東縣',
      until: '2026-10-27T23:00:00+08:00',
    });
  });

  it('미국: 심각도로 등급', () => {
    const out = parseNws(
      {
        features: [
          { id: 'a', properties: { event: 'Hurricane Warning', severity: 'Extreme' } },
          { id: 'b', properties: { event: 'Flood Advisory', severity: 'Minor' } },
        ],
      },
      'GU',
    );
    expect(out.map((a) => [a.names?.[0], a.level, a.country])).toEqual([
      ['Hurricane Warning', 'red', 'GU'],
      ['Flood Advisory', 'info', 'GU'],
    ]);
  });

  it('일본: 그 구역 가장 최근 발표의 발표·계속 중인 것만, 아는 코드로 등급', () => {
    const r = (dt: string, kinds: { code?: string; status: string }[], head: string) => ({
      reportDatetime: dt,
      headlineText: head,
      warning: { class10Items: [{ areaCode: '130010', kinds }] },
    });
    const map = [
      r('2026-10-27T05:00:00+09:00', [{ code: '03', status: '発表' }], '大雨警報を発表'),
      r(
        '2026-10-27T09:00:00+09:00',
        [
          { code: '03', status: '解除' },
          { code: '15', status: '継続' },
          { code: '99', status: '発表' },
        ],
        '強風に注意',
      ),
    ];
    const out = parseJma(map, '130010');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ level: 'info', title: '強風に注意', names: ['強風注意報'] });
    expect(parseJma(map, '999999')).toEqual([]);
  });

  it('일본: 대표 관측소 좌표(도·분) → 구역', () => {
    const st = jmaStations(
      { '130000': [{ class10: '130010', amedas: ['44132'] }] },
      { '44132': { lat: [35, 41.5], lon: [139, 45.0] } },
    );
    expect(st[0]!.class10).toBe('130010');
    expect(st[0]!.lat).toBeCloseTo(35.69, 2);
  });
});

describe('목적지 지점', () => {
  it('일본·미국만, 소수 1자리까지, 고른 나라만', () => {
    expect(parsePoints('JP:35.7:139.7', ['JP'])?.get('JP')).toEqual([[35.7, 139.7]]);
    expect(parsePoints('', ['JP'])?.size).toBe(0);
    expect(parsePoints('JP:35.68:139.69', ['JP'])).toBeNull();
    expect(parsePoints('KR:37.5:127.0', ['KR'])).toBeNull();
    expect(parsePoints('US:40.7:-74.0', ['JP'])).toBeNull();
  });
});

describe('캐나다', () => {
  it('위험 색으로 등급, 구역 이름', async () => {
    const { parseEccc } = await import('../src/services/nationalAlerts');
    const out = parseEccc({
      features: [
        {
          properties: {
            alert_code: 'FTA',
            alert_name_en: 'frost advisory',
            alert_short_name_en: 'Frost (advisory)',
            risk_colour_en: 'yellow',
            feature_name_en: 'Burlington - Oakville',
            feature_id: 'f1',
          },
        },
        {
          properties: {
            alert_code: 'SWW',
            alert_name_en: 'snowfall warning',
            risk_colour_en: 'orange',
          },
        },
      ],
    });
    expect(out.map((a) => [a.names?.[0], a.level, a.area])).toEqual([
      ['Frost (advisory)', 'info', 'Burlington - Oakville'],
      ['snowfall warning', 'orange', undefined],
    ]);
  });
});
