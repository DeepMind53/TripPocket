import { AIRLINE_PROGRAMS, airlineProgramFor } from '@trippocket/shared';
import { useTranslation } from '../../i18n';
import { Chip, ScrollRow } from '../../shared/ui';

/**
 * 항공사 회원번호 칸 아래 칩 (사용자 요청 2026-11-02): 항공사를 모르면 항공사 칩, 알면 그 항공사 등급 칩.
 * 누르면 바로 채운다 — 손으로 쳐도 된다
 */
export function AirlineTierChips({
  airline,
  tier,
  onAirline,
  onTier,
}: {
  airline: string;
  tier: string;
  onAirline: (name: string) => void;
  onTier: (tier: string) => void;
}) {
  const { t } = useTranslation();
  const program = airlineProgramFor(airline);
  if (!program)
    return (
      <ScrollRow role="group" aria-label={t('profile.pickAirline')} className="flex gap-2 pb-1">
        {AIRLINE_PROGRAMS.map((p) => (
          <Chip key={p.code} onClick={() => onAirline(p.name)}>
            {p.name}
          </Chip>
        ))}
      </ScrollRow>
    );
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro text-fg-muted">
        {t('profile.pickTier', { program: program.program })}
      </span>
      {/* 우수 등급이 없는 항공사(LCC 등)는 "등급 없음" 하나 (사용자 요청 2026-11-03) */}
      {program.tiers.length === 0 && (
        <div className="flex gap-2 pb-1">
          <Chip selected={tier === t('profile.noTier')} onClick={() => onTier(t('profile.noTier'))}>
            {t('profile.noTier')}
          </Chip>
        </div>
      )}
      <ScrollRow role="group" aria-label={t('profile.pickTierLabel')} className="flex gap-2 pb-1">
        {program.tiers.map((x) => (
          <Chip key={x} selected={tier === x} onClick={() => onTier(x)}>
            {x}
          </Chip>
        ))}
      </ScrollRow>
    </div>
  );
}
