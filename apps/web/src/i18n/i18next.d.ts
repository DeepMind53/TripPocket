import 'i18next';
import type { defaultNS, resources } from './index';

// t('없는.키')를 타입 검사에서 잡아낸다
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['ko'];
  }
}
