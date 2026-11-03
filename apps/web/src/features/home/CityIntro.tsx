import { InlineIcon } from '../../shared/ui/InlineIcon';
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../data/api/client';
import { settingsRepo } from '../../data/repositories/settingsRepo';
import { useTranslation } from '../../i18n';

interface Summary {
  title: string;
  extract: string;
  url: string;
}

const TTL = 30 * 86_400_000;

/** 서버(위키백과 요약) → 기기에 30일 저장 (오프라인에서도 보이게). 없는 문서면 null */
async function loadSummary(name: string): Promise<Summary | null> {
  const key = `cityIntro:${name}`;
  const hit = await settingsRepo.get<{ at: number; value: Summary | null } | null>(key, null);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const res = await api<{ summary: Summary | null }>(
    `/api/info/summary?title=${encodeURIComponent(name)}`,
  );
  if (!res.ok) return hit?.value ?? null;
  await settingsRepo.set(key, { at: Date.now(), value: res.data.summary });
  return res.data.summary;
}

/**
 * 실험실 "여행지 소개" (docs/26 A4, 2026-11-03): 첫 목적지 이름으로 위키백과 한두 문장.
 * 처음엔 접어 두고, 펼치면 출처(CC BY-SA)와 원문 링크
 */
export function CityIntro({ name }: { name: string }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadSummary(name).then((s) => alive && setSummary(s));
    return () => {
      alive = false;
    };
  }, [name]);
  if (!summary) return null;
  return (
    <div className="flex flex-col rounded-btn bg-bg-subtle px-3 py-1 text-caption text-fg-sub">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-9 items-center gap-1.5 text-left font-semibold text-fg"
      >
        <span className="flex-1">
          <InlineIcon icon={BookOpen} />
          {t('cityIntro.title', { name: summary.title })}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1 pb-2">
          <p>{summary.extract}</p>
          <a
            href={summary.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-9 items-center gap-1 text-micro text-fg-muted"
          >
            {t('cityIntro.source')} · {t('cityIntro.open')}
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        </div>
      )}
    </div>
  );
}
