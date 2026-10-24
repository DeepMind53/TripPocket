import { findAirport, flagEmoji, searchAirports, type Airport } from '@trippocket/shared';
import { useId, useState } from 'react';
import { useTranslation } from '../../i18n';

/**
 * 공항 입력: IATA 코드를 바로 치거나, 공항·도시 이름("간사이", "도쿄")으로 찾아 고른다 (사용자 요청 2026-10-24).
 * 앱에 들어 있는 공항 목록에서만 찾는다(외부 호출 없음). 목록에 없는 공항은 코드 그대로 저장
 */
export function AirportField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  /** 칸 이름 — 아래 공항 이름 안내는 이름에 섞이지 않게 label 밖에 둔다 */
  label: string;
  value: string;
  placeholder: string;
  onChange: (code: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  // 바깥에서 값이 바뀌면(편명으로 불러오기) 칸도 맞춘다 — 렌더 중 맞추기
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== query.trim().toUpperCase()) setQuery(value);
  }
  const listId = useId();
  const picked = findAirport(value);
  const results = open && query.trim() ? searchAirports(query, 6) : [];
  const exact = results.length === 1 && results[0]!.iata === query.trim().toUpperCase();

  const pick = (a: Airport) => {
    setQuery(a.iata);
    setOpen(false);
    onChange(a.iata);
  };

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-semibold text-fg-sub">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={picked && !open ? `${id}-airport` : undefined}
        value={query}
        maxLength={30}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0 && !exact}
        aria-controls={listId}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          const s = e.currentTarget.value;
          setQuery(s);
          setOpen(true);
          // 영문 3글자는 코드로 바로 저장 (목록에 없는 공항도)
          onChange(/^[a-z]{3}$/i.test(s.trim()) ? s.trim().toUpperCase() : s.trim());
        }}
        className="h-12 w-full rounded-btn bg-bg-subtle px-3 text-body-1"
      />
      {picked && !open && (
        <span id={`${id}-airport`} className="truncate text-caption text-fg-muted">
          {flagEmoji(picked.countryCode)} {picked.name} · {picked.city}
        </span>
      )}
      {results.length > 0 && !exact && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('bookings.airportResults')}
          className="absolute top-[76px] right-0 left-0 z-10 flex max-h-64 flex-col divide-y divide-line overflow-y-auto rounded-card border border-line bg-surface shadow-lg"
        >
          {results.map((a) => (
            <li key={a.iata}>
              <button
                type="button"
                role="option"
                aria-selected={a.iata === value}
                // 입력 칸의 blur보다 먼저 고르게
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(a)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left active:bg-bg-subtle"
              >
                <span className="tabular w-10 shrink-0 font-bold text-primary">{a.iata}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body-2">
                    {flagEmoji(a.countryCode)} {a.name}
                  </span>
                  <span className="truncate text-caption text-fg-muted">{a.city}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
