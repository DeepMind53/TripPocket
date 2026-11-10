import { createWorker } from 'tesseract.js';
import coreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import workerUrl from 'tesseract.js/dist/worker.min.js?url';

/**
 * 기기 안 글자 인식 (Tesseract.js, ADR-0012 백업 마지막 단계): 사진을 밖으로 보내지 않는다.
 * 엔진은 우리 주소에서, 언어 파일은 처음 한 번 jsDelivr에서 받아 기기에 보관한다 (그 뒤로는 오프라인).
 * 이 파일은 [분석]을 눌렀는데 서버 인식이 안 될 때만 불러온다 (첫 화면·미리 받기에 없음)
 */
export async function deviceOcr(image: Blob, langs: readonly string[]): Promise<string> {
  const worker = await createWorker([...langs], 1, {
    workerPath: workerUrl,
    corePath: coreUrl,
    workerBlobURL: false,
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
