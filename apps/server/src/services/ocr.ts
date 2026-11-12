import { guardApi, trackApi } from './apiUsage';
import { aPoly, gPoly, rowsFromBoxes } from './ocrRows';

const timeout = () => AbortSignal.timeout(20000);
/** 영수증에 흔한 글자 — 한국·일본·중국·영어 */
const HINTS = ['ko', 'ja', 'zh', 'en'];

/**
 * 영수증 글자 인식 (ADR-0012). 사진은 이 요청에서만 쓰고 어디에도 저장·기록하지 않는다.
 * Cloud Vision Document Text Detection — 키는 주소창이 아니라 머리글로 (로그에 남지 않게)
 */
export async function googleOcr(image: Buffer, apiKey: string): Promise<string> {
  guardApi('google_vision');
  trackApi('google_vision');
  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      requests: [
        {
          image: { content: image.toString('base64') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: HINTS },
        },
      ],
    }),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`vision ${res.status}`);
  const d = (await res.json()) as {
    responses?: {
      fullTextAnnotation?: { text?: string };
      /** [0] = 전체 글, [1..] = 낱말마다 글자 상자 */
      textAnnotations?: {
        description?: string;
        boundingPoly?: { vertices?: { x?: number; y?: number }[] };
      }[];
      error?: { message?: string };
    }[];
  };
  const r = d.responses?.[0];
  if (r?.error) throw new Error(`vision ${r.error.message ?? 'error'}`);
  // 같은 높이 낱말을 한 줄로 (품목 이름 열·금액 열이 따로 읽히는 것 바로잡기). 상자가 없으면 전체 글
  const rows = rowsFromBoxes(
    (r?.textAnnotations ?? [])
      .slice(1)
      .map((w) => ({ text: w.description ?? '', poly: gPoly(w.boundingPoly?.vertices) })),
  );
  return rows || (r?.fullTextAnnotation?.text ?? '');
}

/** Cloud Vision 한 기능만 (장소 알아보기·사진 분류) — 이름과 점수만 돌려준다 (좌표는 버린다) */
export async function googleVisionNames(
  image: Buffer,
  apiKey: string,
  feature: 'LANDMARK_DETECTION' | 'LABEL_DETECTION',
): Promise<{ name: string; score: number }[]> {
  const id = feature === 'LANDMARK_DETECTION' ? 'google_vision_landmark' : 'google_vision_labels';
  guardApi(id);
  trackApi(id);
  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      requests: [
        {
          image: { content: image.toString('base64') },
          features: [{ type: feature, maxResults: 10 }],
        },
      ],
    }),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`vision ${res.status}`);
  const d = (await res.json()) as {
    responses?: {
      landmarkAnnotations?: { description?: string; score?: number }[];
      labelAnnotations?: { description?: string; score?: number }[];
      error?: { message?: string };
    }[];
  };
  const r = d.responses?.[0];
  if (r?.error) throw new Error(`vision ${r.error.message ?? 'error'}`);
  const list = feature === 'LANDMARK_DETECTION' ? r?.landmarkAnnotations : r?.labelAnnotations;
  return (list ?? [])
    .filter((x): x is { description: string; score?: number } => !!x.description)
    .map((x) => ({ name: x.description, score: Math.round((x.score ?? 0) * 100) / 100 }));
}

/** Azure AI Vision Image Analysis 4.0 Read (F0 무료 등급) — 줄 단위 글을 이어 붙인다 */
export async function azureOcr(image: Buffer, endpoint: string, apiKey: string): Promise<string> {
  guardApi('azure_read');
  trackApi('azure_read');
  const url = new URL('/computervision/imageanalysis:analyze', endpoint);
  url.searchParams.set('api-version', '2024-02-01');
  url.searchParams.set('features', 'read');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'Ocp-Apim-Subscription-Key': apiKey },
    body: new Uint8Array(image),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`azure read ${res.status}`);
  const d = (await res.json()) as {
    readResult?: {
      blocks?: {
        lines?: { text?: string; words?: { text?: string; boundingPolygon?: unknown[] }[] }[];
      }[];
    };
  };
  const lines = (d.readResult?.blocks ?? []).flatMap((b) => b.lines ?? []);
  // 같은 높이 낱말을 한 줄로 (Azure도 열마다 따로 읽는다). 상자가 없으면 읽은 줄 그대로
  const rows = rowsFromBoxes(
    lines
      .flatMap((l) => l.words ?? [])
      .map((w) => ({ text: w.text ?? '', poly: aPoly(w.boundingPolygon) })),
  );
  return rows || lines.map((l) => l.text ?? '').join('\n');
}
