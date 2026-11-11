import type { PhotoTranslation, VisionNames } from '@trippocket/shared';
import { api } from '../api/client';

export type VisionError = 'limit' | 'unavailable';

const send = <T>(path: string, image: Blob) =>
  api<T>(path, { method: 'POST', body: image, headers: { 'content-type': 'image/jpeg' } });

const fail = (code: string | undefined): VisionError =>
  code === 'vision_daily' ? 'limit' : 'unavailable';

/**
 * 사진 기능 요청 (실험실, ADR-0012): 누를 때만 그 사진 한 장을 홈 서버로. 서버는 저장·기록하지 않는다.
 * 실패면 이유만 돌려준다 (오늘 한도 / 쓸 수 없음)
 */
export async function translatePhoto(image: Blob): Promise<PhotoTranslation | VisionError> {
  const r = await send<PhotoTranslation>('/api/vision/translate', image);
  return r.ok ? r.data : r.reason === 'error' ? fail(r.code) : 'unavailable';
}

export async function photoNames(
  image: Blob,
  feature: 'landmark' | 'labels',
): Promise<VisionNames | VisionError> {
  const r = await send<VisionNames>(`/api/vision/${feature}`, image);
  return r.ok ? r.data : r.reason === 'error' ? fail(r.code) : 'unavailable';
}
