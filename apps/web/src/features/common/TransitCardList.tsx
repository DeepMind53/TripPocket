import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { transitCardsFor, type TransitCard } from '../../data/transitCards';
import { useTranslation } from '../../i18n';

/**
 * 나라별 교통카드·승차권 이름 칩 — 누르면 사진(없으면 그린 카드)·출처·공식 안내를 펼친다 (사용자 요청 2026-11-03).
 * 사진은 앱에 들어 있어 인터넷 없이도 보인다
 */
export function TransitCardList({ country }: { country: string }) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const cards = transitCardsFor(country);
  if (!cards.length) return null;
  const open = cards.find((c) => c.id === openId);
  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-expanded={c.id === openId}
            onClick={() => setOpenId(c.id === openId ? null : c.id)}
            className={`min-h-9 rounded-full border px-3 text-caption font-semibold ${
              c.id === openId
                ? 'border-primary bg-primary text-on-primary'
                : 'border-line bg-bg text-fg'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {open && <CardView card={open} />}
      {!open && <span className="text-micro text-fg-muted">{t('localInfo.cardsHint')}</span>}
    </div>
  );
}

function CardView({ card: c }: { card: TransitCard }) {
  const { t } = useTranslation();
  return (
    <figure className="flex flex-col gap-1.5">
      {c.photo ? (
        <img
          src={c.photo.src}
          alt={c.name}
          loading="lazy"
          className="max-h-56 w-full rounded-card bg-bg object-contain"
        />
      ) : (
        // 쓸 수 있는 사진이 없는 카드: 색과 이름만 그린다 (상표 로고 없음)
        <div
          role="img"
          aria-label={t('localInfo.drawn', { name: c.name })}
          style={{ backgroundColor: c.color }}
          className="grid aspect-[1.586] w-full max-w-72 place-items-center self-center rounded-card p-4 text-center text-body-1 font-bold text-white shadow-sm"
        >
          {c.name}
        </div>
      )}
      <figcaption className="flex flex-col gap-1 text-micro text-fg-muted">
        {c.photo ? (
          <a href={c.photo.page} target="_blank" rel="noopener noreferrer" className="underline">
            {t('localInfo.photoCredit', { author: c.photo.author, license: c.photo.license })}
          </a>
        ) : (
          <span>{t('localInfo.drawnNote')}</span>
        )}
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-9 items-center gap-1 text-caption font-semibold text-primary"
        >
          {t('localInfo.official', { name: c.name })}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </figcaption>
    </figure>
  );
}
