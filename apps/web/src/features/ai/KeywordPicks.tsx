import type { PlaceSummary, SourcePost } from '@trippocket/shared';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { openMapLink, placeLink } from '../../shared/lib/directions';
import { IconButton } from '../../shared/ui';

export interface KeywordPick {
  keyword: string;
  mentions: number;
  sources: SourcePost[];
  places: PlaceSummary[];
}

/**
 * 해외 AI 추천의 "블로그 인기 키워드" 칸: 블로그에 자주 나온 키워드(예: 규카츠)로 기준점 주변을 지도에서 찾은 곳.
 * 가게 자체의 블로그 근거는 없으므로 장소 추천과 나눠 보여 주고, 키워드의 근거 글만 단다
 */
export function KeywordPicks({ picks }: { picks: KeywordPick[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 rounded-card bg-bg-subtle p-3">
      <p className="text-caption whitespace-pre-line text-fg-muted">{t('ai.keywordNote')}</p>
      {picks.map((k) => (
        <div key={k.keyword} className="flex flex-col gap-1.5">
          <p className="text-body-2 font-semibold">
            {t('ai.keywordPick', { keyword: k.keyword, n: k.mentions })}
          </p>
          <ul className="flex flex-col gap-1">
            {k.places.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-2">{p.name}</span>
                  {p.address && (
                    <span className="truncate text-caption text-fg-muted">{p.address}</span>
                  )}
                </span>
                <IconButton
                  label={t('placeSearch.openMap', { name: p.name })}
                  icon={<ExternalLink />}
                  onClick={() =>
                    openMapLink(
                      placeLink(
                        'google',
                        {
                          name: p.name,
                          ...(p.address ? { address: p.address } : {}),
                          ...(p.coords ? { coords: p.coords } : {}),
                          ...(p.source === 'google' ? { googlePlaceId: p.id } : {}),
                        },
                        window.location.hostname,
                      ),
                    )
                  }
                />
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-0.5">
            {k.sources.slice(0, 3).map((s) => (
              <li key={s.link} className="flex gap-2 text-caption">
                <span className="tabular shrink-0 text-fg-muted">
                  {s.postdate.slice(4, 6)}.{s.postdate.slice(6, 8)}
                </span>
                {/* 원문은 텍스트로만 (docs/14 §8) */}
                <a
                  href={s.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-primary"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
