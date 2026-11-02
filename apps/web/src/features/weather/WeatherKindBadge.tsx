import { useTranslation } from '../../i18n';
import { KIND_ICON, type WeatherKind } from './weatherKind';

/**
 * 날씨 줄마다 붙는 달력 그림 + 짧은 이름 (사용자 요청 2026-11-02: 설명 글 대신 한눈에).
 * 자세한 설명은 날씨 정보 제목 옆 ? 버튼
 */
export function WeatherKindBadge({ kind }: { kind: WeatherKind }) {
  const { t } = useTranslation();
  const { Icon, color } = KIND_ICON[kind];
  return (
    <span className={`inline-flex items-center gap-0.5 text-micro ${color}`}>
      <Icon aria-hidden="true" className="size-3.5" />
      {t(`weatherPage.kind.${kind}`)}
    </span>
  );
}
