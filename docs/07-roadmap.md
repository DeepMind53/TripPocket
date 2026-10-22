# 07. 로드맵 / 마일스톤

각 마일스톤 종료 조건(DoD): lint·typecheck·unit test 통과, 모바일 360px 수동 확인, 해당 E2E 시나리오 통과, 문서 갱신.

## M0. 기반 세팅 (0.5~1일)
- [ ] `08-open-decisions.md` 확정 → ADR 반영
- [ ] Vite + React + TS strict 스캐폴딩
- [ ] ESLint/Prettier/경계 규칙, Husky + lint-staged
- [ ] Vitest + fake-indexeddb, Playwright(모바일 뷰포트) 세팅
- [ ] Tailwind + 디자인 토큰 + 기본 UI(Button, BottomSheet, Toast, EmptyState)
- [ ] i18n 구조, 라우터, AppShell(하단 탭바)
- [ ] vite-plugin-pwa (manifest, 아이콘, SW, 업데이트 토스트)
- [ ] GitHub 저장소 + CI(GitHub Actions: lint/test/build) + 정적 호스팅 자동 배포

## M1. 여행 + 일정 MVP (핵심)
- [ ] domain: 날짜 유틸, fractional index, Zod 타입
- [ ] data: Dexie v1 스키마, tripRepo, itemRepo
- [ ] S-01 여행 목록, S-03 여행 생성/편집/삭제(실행취소)
- [ ] S-04 Day 뷰, S-05 아이템 편집 시트, S-06 상세(지도 앱 열기, 주소 복사)
- [ ] 드래그 정렬 + 다른 날로 이동
- [ ] 기간 변경 시 영향 미리보기 (S-14 일부)
- **E2E**: 여행 생성 → 아이템 3개 추가 → 순서 변경 → 새로고침 후 유지 → 오프라인에서 열림

## M2. 데이터 안전
- [ ] 전체 백업/복원 (병합/새로추가/교체), 여행 단위 내보내기/가져오기
- [ ] `storage.persist()`, 설치 안내(S-18), 인앱 브라우저 감지
- [ ] 백업 리마인더, 저장공간 사용량 표시
- **E2E**: 백업 → DB 비우기 → 복원 → 데이터 동일

> M1 다음에 바로 M2를 하는 이유: 실제 데이터를 넣기 시작하면 유실 방지가 최우선이기 때문.

## M2.5 홈 서버 + 로그인 + 동기화
- [ ] 모노레포 전환(apps/web, apps/server, packages/shared)
- [ ] Fastify 서버 골격, config Zod 검증, helmet/cors/rate-limit, /healthz
- [ ] SQLite + Drizzle 스키마, 서버 마이그레이션
- [ ] 소셜 로그인 1종(네이버 또는 구글)으로 시작 → 나머지 추가
- [ ] 세션/로그아웃/기기 목록, 회원 탈퇴
- [ ] sync push/pull + 웹 sync 엔진, 첫 로그인 업로드 플로우
- [ ] 인가 테스트(다른 사용자 데이터 접근 차단) 자동화
- [ ] ops: WinSW 서비스, cloudflared 터널, 백업 스크립트 + 복구 리허설
- [ ] `09` 문서 §7 보안 체크리스트 점검 → 통과 후 외부 공개
- **E2E**: 기기 A에서 여행 생성(오프라인) → 온라인 복귀 동기화 → 기기 B 로그인 시 동일 데이터

## M3. 예약 + 오늘
- [ ] Booking CRUD (항공/숙소 우선), 항공 카드, 숙소 Day 하단 파생 표시
- [ ] S-02 오늘 홈 (다음 일정, 오늘 숙소)
- [ ] 예약번호 복사

## M4. 준비물 + 저장한 장소
- [ ] 체크리스트(준비물/할 일), 기본 템플릿
- [ ] 저장 탭(SavedPlace) → 여행에 담기

## M4.5 지도 · 장소 · 길찾기
- [ ] `buildDirectionsUrl` (구글/네이버 × 대중교통/도보/자동차) + 길찾기 버튼 — **로그인 불필요, 일찍 넣어도 됨**
- [ ] MapProvider 인터페이스 + Google / Naver 구현, Day별 핀·순서선
- [ ] 서버 places 프록시: Google Text Search(평점·리뷰 수 필터), Place Details(리뷰), 네이버 지역 검색
- [ ] 사용자별 일일 한도, Google Cloud 쿼터·예산 알림
- [ ] S-19 장소 찾기 화면(카테고리·필터·정렬), 장소 상세 시트, 일정에 추가
- [ ] 현재 위치 표시·거리 (P1)

## M4.7 빠른 메뉴 · 설정 · 환율
- [ ] 설정 컨트롤 컴포넌트(Segmented, Switch, RadioList, Stepper, Slider, NumberInput) + Settings Zod 스키마
- [ ] S-23 설정 화면 전체 그룹, 빠른 메뉴(S-50) 바로가기·빠른 설정
- [ ] 서버 `/api/fx/latest` + 수출입은행 스케줄 수집, 웹 FxCache
- [ ] S-51 환율 계산기 (NumPad, 빠른 금액, 네이버 환율 링크)

> 설정 화면 골격(테마·시간 표기)은 M0~M1에서 먼저 만들고, 항목은 기능이 생길 때마다 추가한다.

## M4.8 AI 추천
- [ ] 기준점 결정(가까운 역: 카카오/Google, 숙소, 직접 입력 자동완성)
- [ ] 네이버 블로그 수집 + 기간 단계 확장(1→3→6→12개월)
- [ ] Claude API 추출·정리(구조화 출력, sourceIds 검증), Google Places 검증, 점수 계산
- [ ] S-52 화면, 근거 보기, 하루 한도·캐시
- [ ] 평가 세트(신주쿠역·성수역·서면역)로 정확도 측정

## M5. 공유 & 편의 (P1 묶음)
- [ ] 로그인 없이 보는 공유 링크(S-40), 일정 이미지 저장, 텍스트 요약 공유
- [ ] 위시리스트, 타임라인 뷰, 초대 링크 공동 편집
- [ ] 인쇄 CSS, .ics, 다크 모드, 영어
- [ ] 첨부(이미지/PDF) + ZIP 백업

## M6. 출시 준비
- [ ] Lighthouse PWA/성능/접근성 점검, 실제 기기(iOS/Android) 테스트
- [ ] 개인정보처리방침/소개 페이지, 도메인 연결
- [ ] 실제 여행 1회 dogfooding

## P2 백로그
예약 메일 파싱, 오프라인 지도, 실시간 공동 편집(SSE), 패스키, 앱 내 경로 미리보기, 앱 잠금, 여행 회고, 이동시간 계산, 커버 사진.
