# ADR-0007: 무료량이 끝났을 때 백업 — Google 자동완성 · Geoapify · MapLibre + OpenFreeMap

- 상태: 확정
- 날짜: 2026-10-26

## 배경 (Context)
해외 장소 검색(Google Text Search, 월 5,000)·평점(월 1,000)·택시 카드 현지어 이름(월 5,000)·해외 지도(월 10,000)는
무료량의 90%에서 자동으로 멈춘다(과금 방지). 멈춘 뒤 그달 남은 기간에는 기능이 비었다.
사용자 결정(2026-10-26): **무료 방식만**, 기존 API는 그대로 두고 **백업**으로 추가 (docs/23).

## 결정 (Decision)
1. **해외 검색**: Text Search → (이번 달 무료량 끝) Google 자동완성 + 상세 Essentials (각 월 1만 무료, 세션 토큰으로 묶음) → Geoapify(하루 3,000 무료) → 지도 앱 링크
2. **평점·영업시간**: Google 상세가 멈추면 트립포켓 후기 별점 + "Google 지도에서 보기" 링크 (대체 API 없음)
3. **택시 카드 현지어 이름**: Google → Geoapify 역지오코딩(좌표, Google에서 받지 않은 좌표만)
4. **해외 지도**: 고른 지도(Google·네이버)를 못 쓰면 MapLibre GL + OpenFreeMap (새 의존성 `maplibre-gl`, 지도 화면에서만 지연 로딩, 서비스 워커가 미리 받지 않음)
5. ADR-0004의 외부 API 범위에 Geoapify(서버 프록시)·OpenFreeMap(브라우저 타일)을 더한다. 둘 다 `apiUsage.ts`에 등록

## 검토한 대안
| 대안 | 장점 | 단점 |
|---|---|---|
| 넘으면 돈 내고 계속 | 품질 그대로 | 사용자 결정: 무료만 |
| Nominatim·Photon 공개 서버 | 키 없음 | 초당 1건·자동완성 금지, 장애 시 대체 없음 → 이번에는 넣지 않음 |
| 지도 백업 없이 링크만 | 의존성 없음 | 해외 일정 지도가 통째로 빔 |

## 결과 (Consequences)
- 좋아지는 점: 무료량이 끝나도 그달 남은 기간 검색·지도·택시 카드가 동작. 비용 0
- 감수하는 점:
  - Google 약관상 **Google에서 받은 좌표는 Google 지도가 아닌 지도(네이버·MapLibre)에 올리지 않는다** → 백업 지도에는 공항·직접 넣은 장소·OSM 결과만 핀으로
  - Geoapify(OSM)는 일본·대만 식당·가게가 Google보다 적다. 출처 표기 필수("Powered by Geoapify · © OpenStreetMap")
  - 지도 백업 청크 약 285KB(gzip) — 첫 화면에는 영향 없음
- 후속 작업: Geoapify 키 발급(사용자) → `apps/server/.env` `GEOAPIFY_KEY`, 무료 플랜·약관 변경은 월간 점검(docs/22 B1)
