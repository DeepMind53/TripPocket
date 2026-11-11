# ADR-0012: 일정 사진·영수증 — 사진은 기기에만, 영수증 글자 인식은 누를 때만 외부로

- 상태: 확정
- 날짜: 2026-11-11

## 배경 (Context)
사용자 요청(2026-11-11): 빠른 메뉴에서 사진·영수증을 찍으면 지금 일정에 붙고, 영수증은 글자를 읽어 품목·금액을 보여 준다.
사진은 "로컬에만 무조건" 저장한다.
CLAUDE.md는 사용자 데이터를 ADR-0004 범위 밖으로 보내지 못하게 하고, 가계부(지출 기록)와 금액 저장을 범위에서 뺐다 → 이 ADR로 범위를 정한다.

사용자 결정(2026-11-11):
- 글자 인식은 Google Cloud Vision (월 1,000장 무료), 백업은 Azure AI Vision Read (F0 월 5,000장) → 기기 안 Tesseract.js
- 사진을 밖으로 보내는 것은 [영수증 분석]을 누를 때만 (일반 사진은 보내지 않음)
- 영수증은 사진과 읽은 글만 저장하고, 품목·금액 표는 볼 때 계산 (금액 따로 저장 안 함)
- 지금 진행 중인 일정이 없으면 바로 앞 일정(없으면 다음)에 붙이고, 일정 상세에서 날짜·일정을 골라 옮긴다
- 새 기능이라 실험실(`tripPhotos`)에 먼저, [샘플] 포함

## 결정 (Decision)
1. **사진은 기기에만.** Dexie v13 `photos` 표 (id·tripId·itemId·kind·blob·createdAt·text·textSource). 동기화·서버 업로드·백업 JSON에 넣지 않는다.
   긴 변 1600px JPEG로 줄여 저장한다. 아예 지운 일정의 사진은 휴지통 정리 때 함께 지운다
2. **글자 인식 경로:** 웹 → 홈 서버 `POST /api/ocr`(로그인, JPEG 본문 4MB까지) → Google Vision `DOCUMENT_TEXT_DETECTION` → 실패·한도면 Azure Read.
   서버는 사진을 저장·기록하지 않고 결과 글만 돌려준다. 키는 서버 `.env`에만 (`GOOGLE_VISION_KEY` 없으면 `GOOGLE_PLACES_KEY`, `AZURE_VISION_*`)
3. **과금 방어:** `google_vision`(과금 가능, 월 1,000)·`azure_read`(무료, 월 5,000)를 `APIS`에 등록 → 95%에서 자동 중지. 한 사람 하루 20장 (`places_usage` kind `ocr`)
4. **마지막 백업:** 서버가 안 되면(오프라인·한도·키 없음·오류) 기기 안 Tesseract.js로 읽는다. 엔진은 우리 주소에서, 언어 파일은 jsDelivr에서 처음 한 번 받는다.
   CSP `script-src`에 `'wasm-unsafe-eval'`을 더한다. 엔진(약 4MB)은 미리 받기에서 뺀다
5. **가계부와 구분:** 저장하는 것은 사진과 읽은 글이다. 품목·금액·합계는 화면에서 글로부터 계산해 보여 줄 뿐 지출·예산·정산으로 쌓지 않는다
6. 개인정보 처리방침·출처에 Google Cloud Vision·Azure AI Vision·Tesseract.js를 적는다

## 추가 (2026-11-11, 사용자 선택): 사진 기능 3개 — 같은 원칙
- **사진으로 번역** (`photoTranslate`): 번역·회화 화면에서 찍거나 고른 사진 → `POST /api/vision/translate` → Google 글자 읽기(안 되면 Azure) → 읽은 글 줄만 무료 AI(Gemini → Workers AI → Groq)로 한국어. 사진·번역 모두 저장 안 함. 하루 20장
- **사진 속 장소** (`photoLandmark`): 일정 사진 크게 보기 → `POST /api/vision/landmark` → Landmark Detection. 이름·확신도만 돌려주고 좌표는 버린다(Google 좌표는 Google 지도에만). [담기]는 이름만 가고 싶은 곳에. 하루 20장, `google_vision_landmark`(월 1,000 무료)
- **사진 분류** (`photoLabels`): 기록 탭 사진 모아보기 [분류하기] → 아직 안 나눈 사진만 `POST /api/vision/labels` → Label Detection → 기기에서 음식·풍경·건물·사람·기타로(`domain/photoTags.ts`), 묶음만 기기에 저장(Dexie v14 `tag`). 영수증은 보내지 않는다. 하루 60장, `google_vision_labels`(월 1,000 무료)
- Cloud Vision은 기능마다 월 1,000건 따로 무료라 영수증 읽기와 무료량을 나눠 쓰지 않는다. 사진 번역 글자 읽기는 영수증과 같은 `google_vision`을 쓴다

## 검토한 대안
| 대안 | 장점 | 단점 |
|---|---|---|
| 기기 안 인식만 (Tesseract) | 사진이 밖으로 안 나감 | 한·일 영수증 정확도가 낮고 느림 — 마지막 백업으로만 |
| OCR.space 무료 키 | 월 2.5만 장, 가입 쉬움 | 1MB 제한, 최근 정확도 저하 보고 — 사용자 결정으로 Azure |
| 품목·금액을 따로 저장 | 표를 다시 계산하지 않음 | 지출 기록(가계부)이 됨 — 사용자 결정으로 글만 |
| 사진을 서버에도 올려 기기 간 공유 | 다른 기기에서도 보임 | "로컬에만" 요청과 맞지 않음 |

## 결과 (Consequences)
- 좋아지는 점: 무료량 안에서 영수증 글을 꽤 정확하게 읽고, 사진은 기기를 떠나지 않는다(분석을 누를 때 그 한 장만 예외)
- 감수하는 점: 기기를 바꾸거나 앱 데이터를 지우면 사진이 사라진다(아이폰은 홈 화면 설치 권장). 읽은 글이 틀리면 사용자가 고쳐야 한다.
  Google 결제 계정·Azure 가입·키 등록은 사용자가 한다. 키가 없으면 기기 안 인식만 쓴다
