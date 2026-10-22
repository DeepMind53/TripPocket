// 브라우저·Node.js 공통 Web Crypto (DOM 타입 전체를 끌어오지 않기 위해 필요한 것만 선언)
declare const crypto: {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
};
