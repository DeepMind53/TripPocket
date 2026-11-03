import { airlineProgramFor, searchAirlines } from '@trippocket/shared';
import { useTranslation } from '../../i18n';

const field =
  'h-11 w-full min-w-0 rounded-btn border border-line bg-bg-subtle px-3 text-body-2 outline-none focus:border-primary';

/**
 * 항공사 칸 (사용자 요청 2026-11-03): 글자를 치면 입력창 오른쪽에 추천 항공사 — 누르면 그 이름으로 채운다.
 * (예전 아래쪽 알약 칩 대신). 손으로 끝까지 쳐도 된다
 */
export function AirlineInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const { t } = useTranslation();
  const picks = searchAirlines(value, 2);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <input
        aria-label={t('profile.airline')}
        placeholder={t('profile.airlinePlaceholder')}
        maxLength={40}
        className={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {picks.map((p) => (
        <button
          key={p.code}
          type="button"
          aria-label={t('profile.pickAirlineName', { name: p.name })}
          onClick={() => onChange(p.name)}
          className="h-9 shrink-0 rounded-full border border-primary/40 bg-primary-weak px-2.5 text-caption font-semibold whitespace-nowrap text-primary"
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

/**
 * 등급 칸 (사용자 요청 2026-11-03): 아는 항공사면 그 회원 프로그램 등급을 드롭다운으로,
 * 등급 제도가 없는 항공사(국내·해외 LCC)는 "등급 없음" 하나, 모르는 항공사면 직접 입력
 */
export function TierSelect({
  airline,
  value,
  onChange,
}: {
  airline: string;
  value: string;
  onChange: (tier: string) => void;
}) {
  const { t } = useTranslation();
  const program = airlineProgramFor(airline);
  if (!program)
    return (
      <input
        aria-label={t('profile.tier')}
        placeholder={t('profile.tier')}
        maxLength={30}
        className={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  const options = program.tiers.length ? [...program.tiers] : [t('profile.noTier')];
  return (
    <select
      aria-label={t('profile.tierOf', { program: program.program })}
      // 등급 제도가 없으면 처음부터 "등급 없음"으로 보인다
      value={options.includes(value) ? value : program.tiers.length ? '' : options[0]}
      onChange={(e) => onChange(e.target.value)}
      className={field}
    >
      <option value="">{t('profile.tierPick')}</option>
      {options.map((x) => (
        <option key={x} value={x}>
          {x}
        </option>
      ))}
    </select>
  );
}
