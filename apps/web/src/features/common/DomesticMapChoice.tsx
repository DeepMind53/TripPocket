import { chooseDomesticMap } from '../../data/mapChoice';
import { useTranslation } from '../../i18n';
import { Button } from '../../shared/ui';

/** 앱 안 국내 지도가 "매번 묻기"일 때, 지도를 불러오기 전에 이번 접속에 쓸 지도를 고른다 */
export function DomesticMapChoice() {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-body-2 font-semibold whitespace-pre-line">{t('map.askTitle')}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => chooseDomesticMap('naver')}>
          {t('dir.naver')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => chooseDomesticMap('kakao')}>
          {t('dir.kakao')}
        </Button>
      </div>
    </div>
  );
}
