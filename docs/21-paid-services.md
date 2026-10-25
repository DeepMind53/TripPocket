# 21. 가성비 좋은 유료 서비스 — 트립포켓 · 니하오(Study_Taiwan_Chinese)

> 2026-10-25 사용자 요청: "유료지만 두 앱에서 가성비 좋게 쓸 수 있는 앱·구독이 있으면 어디에 어떻게 쓸지 상세히".
> 지금은 **둘 다 무료로 돌아간다** — 아래는 "막히거나 더 좋게 하고 싶을 때" 고를 목록. 결제는 사용자가 결정 (CLAUDE.md 무료 우선).
> 가격은 2026-10 기준 (출처 맨 아래). 실제 결제 전 공식 가격표로 다시 확인.

## 한눈에 (추천 순)

| 순위 | 서비스 | 대략 비용 | 어느 앱 | 바로 좋아지는 것 |
|---|---|---|---|---|
| 1 | **Gemini API 종량제** (Flash-Lite) | 월 1~3천 원 | 둘 다 | AI 하루 한도·속도 걱정 끝, **입력 내용이 학습에 쓰이지 않음** |
| 2 | **Azure 음성 S0** (발음 채점) | 연습 720번에 약 1,800원 | 니하오 | 무료 5시간을 넘겨도 정밀 채점 계속 |
| 3 | **AeroDataBox** (항공편) | 월 약 7,000원~ | 트립포켓 | 미래 날짜 편명으로 정확한 시간·터미널, 월 100회 제한 해제 |
| 4 | **Google Play 개발자** | 한 번 25달러 | 둘 다 | 플레이스토어에 앱으로 등록 (지금 웹앱 그대로 감싸기) |
| 5 | **Supabase Pro** | 월 25달러 | 니하오 | 무료 한도(전송량 5GB·1주 미사용 정지)를 넘을 때만 |
| 6 | Apple 개발자 | 연 99달러 | 둘 다 | 앱스토어 등록 (아이폰 웹앱으로도 알림은 이미 됨) |
| — | Cloudflare Workers 유료 | 월 5달러 | 트립포켓 | 하루 10만 요청을 넘을 때만 — 지금은 불필요 |

## 1. Gemini API 종량제 — 둘 다, 가장 추천

- **지금**: 무료 등급(하루 한도, 바쁘면 거절) → 막히면 Workers AI → Groq → AI 없이
- **바꾸면**: Google AI Studio에서 결제 수단을 연결해 유료 등급으로. Flash-Lite 기준 **입력 100만 토큰 0.10달러, 출력 0.40달러**
  - 트립포켓 AI 추천 1번 ≈ 입력 6천 + 출력 1천 토큰 → **약 1.5원**. 하루 30번 써도 월 1,500원 정도
  - 니하오: AI 코치·상황 대화·단어 검증 스크립트(`scripts/verify-vocab-ai.mjs`)
- **좋은 점**: 하루 한도·429 거절이 거의 사라짐, 응답이 빨라짐, **유료 등급은 보낸 내용을 Google 학습에 쓰지 않음**(지금 무료 등급은 쓸 수 있음 — 개인정보 처리방침에 적어 둔 부분이 사라짐)
- **어떻게**: 트립포켓은 `services/llm.ts` 순서 그대로, 키만 유료 프로젝트 것으로. 트립포켓 API 사용량 화면의 **월 상한(예: 5,000회)**을 걸어 두면 그 이상 안 씀. Google Cloud **예산 알림**(예: 월 5달러)도 함께 — 알림만 오고 자동으로 멈추지는 않으니 우리 상한이 실제 안전장치
- **주의**: 결제 수단을 연결하면 지도·장소 같은 다른 Google API도 "무료 한도 넘으면 과금" 상태가 된다 → **AI용 Google 프로젝트를 따로** 만드는 것을 권장

## 2. Azure 음성 S0 — 니하오 발음 채점

- **지금**: `scripts/pron-server.py` — Azure 무료(F0, 월 5시간)가 먼저, 소진(429)되면 Whisper+성조 분석으로
- **바꾸면**: 같은 키를 S0(표준) 등급으로. 실시간 인식 + 발음 평가 **시간당 약 1.3달러**
  - 문장 하나 읽기 ≈ 5초 → 1시간 = 약 720번 → **1번에 약 2.5원**
- **좋은 점**: 무료 5시간을 다 써도 음소 단위 정확도·유창성 채점이 끊기지 않음 (Whisper 대체 채점보다 정확)
- **어떻게**: Azure 포털에서 Speech 리소스 가격 등급만 F0 → S0. 서버 코드는 그대로. **월 예산 알림 + 사용량 확인** 필수 (Azure는 기본으로 자동 정지가 없음)

## 3. AeroDataBox — 트립포켓 항공편 불러오기

- **지금**: AviationStack 무료 — 월 100회, **최근 운항 기록**만(미래 날짜 시간표 아님), 90회에서 자동 중지
- **바꾸면**: AeroDataBox(RapidAPI/API.Market) 기본 유료 **월 약 5달러~**(무료 600단위도 있음)
  - 날짜를 넣은 편명 조회(미래 운항편), 터미널·게이트, 공항 시간대가 더 정확
  - AviationStack 유료는 월 50달러부터라 비쌈
- **어떻게**: `services/flights.ts`에 AeroDataBox 어댑터 추가 → 무료 600단위 먼저 써 보고 부족하면 유료. `APIS`에 등록해 월 상한
- **주의**: "단위 ≠ 요청 수" (엔드포인트마다 소모 단위가 다름) — 무료로 실제 소모량을 먼저 재 볼 것

## 4. Google Play 개발자 등록 — 한 번 25달러

- **트립포켓**: 지금 웹앱(PWA)을 **TWA(신뢰할 수 있는 웹 활동)**로 감싸 플레이스토어에 올림 — 코드는 그대로, 설치·업데이트가 익숙한 방식으로. 알림·오프라인도 그대로
- **니하오**: Expo 앱을 로컬 빌드(무료)로 만들어 올림. EAS 빌드 유료(월 19달러~)는 필요 없음
- 한 번 내면 평생, 두 앱 모두 한 계정으로

## 5. Supabase Pro — 니하오, 한도를 넘을 때만

- **무료 한도**: DB 500MB, 파일 1GB, **전송 5GB/월**, 1주일 안 쓰면 프로젝트 일시 정지
- **위험 지점**: 음성 뱅크(mp3)를 여러 사람이 처음 받을 때 전송량이 빠르게 찬다
- **Pro 월 25달러**: 전송 250GB, 파일 100GB, 정지 없음. **지출 상한(Spend cap)이 기본으로 켜져** 있어 넘으면 과금 대신 멈춤
- **먼저 해 볼 무료 대안**: 음성 파일을 이미 쓰는 Cloudflare(트립포켓 도메인)로 옮기면 전송량 걱정이 줄어든다 (Cloudflare R2 무료 10GB 저장·전송 무료) — 이것부터 권장

## 6. Apple 개발자 — 연 99달러 (나중에)

- 아이폰 웹앱(홈 화면에 추가)으로 이미 알림·오프라인이 되므로 **지금은 불필요**
- 앱스토어에 꼭 올리고 싶거나, 아이폰 위젯·백그라운드 기능이 필요해질 때

## 쓰지 않아도 되는 것

- **Cloudflare Workers 유료(월 5달러)**: 무료 하루 10만 요청 — 지금 사용량의 수백 배
- **Google 지도·장소 유료 플랜**: 이미 무료 월 한도 안에서 자동 중지로 운영 중
- **Expo EAS 유료**: 로컬 빌드로 충분
- **Tailscale 유료**: 개인 무료로 충분

## 결정이 필요한 것

1. Gemini 유료(AI용 별도 Google 프로젝트)로 바꿀까요? — 바꾸면 트립포켓 키 교체·상한 설정을 해 드릴게요
2. 니하오 Azure S0 / Supabase 관련은 니하오 담당 작업에서 진행 (이 문서는 정보만)
3. 항공편: AeroDataBox 무료 600단위로 먼저 시험해 볼까요?

## 출처 (2026-10 확인)

- Gemini API 가격: https://www.morphllm.com/gemini-api-pricing · https://tokencost.app/models/gemini-2-5-flash-lite
- Supabase 가격: https://supabase.com/pricing
- Azure 발음 평가 비용: https://learn.microsoft.com/en-in/answers/questions/5608069/pricing-and-usage-of-pronunciation-assessment-feat · https://api.toneperfect.app/blog/pronunciation-assessment-api-pricing-compared/
- 항공편 API 비교: https://geekflare.com/dev/flight-data-api/
- Cloudflare Workers: https://makerkit.dev/pricing-calculator/cloudflare
- 앱스토어 비용: https://studio.adalo.com/blog/apple-developer-program-guide · Expo EAS: https://vibecoding.app/blog/expo-eas-review
