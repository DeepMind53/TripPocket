import { telHref } from '@trippocket/shared';
import { Phone } from 'lucide-react';
import { useTravelProfile } from '../../data/travelProfile';
import { useTranslation } from '../../i18n';

/**
 * 긴급 연락처 화면 맨 위 "내 비상 정보" (사용자 요청 2026-11-02): 마이 → 개인정보에 적은 보험·비상 연락처·혈액형.
 * 누르면 바로 전화. 적은 것이 없으면 아무것도 그리지 않는다
 */
export function MySafetyInfo() {
  const { t } = useTranslation();
  const p = useTravelProfile();
  const ins = p.insurance;
  const contacts = p.contacts.filter((c) => c.phone.trim());
  const hasIns = !!(ins.company || ins.policyNo || ins.phone);
  if (!hasIns && contacts.length === 0 && !p.bloodType) return null;
  const call = (label: string, sub: string, phone: string) => (
    <a
      key={`${label}-${phone}`}
      href={telHref(phone)}
      className="flex min-h-14 items-center gap-2 rounded-card border border-line bg-surface px-3 py-2"
    >
      <Phone aria-hidden="true" className="size-4 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-caption text-fg-sub">{label}</span>
        <span className="tabular text-body-1 font-bold">{phone}</span>
        {sub && <span className="truncate text-micro text-fg-muted">{sub}</span>}
      </span>
    </a>
  );
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body-1 font-bold">{t('emergency.mine')}</h3>
      {hasIns &&
        (ins.phone ? (
          call(
            ins.company || t('profile.insurance'),
            ins.policyNo ? t('emergency.policy', { no: ins.policyNo }) : '',
            ins.phone,
          )
        ) : (
          <p className="text-body-2 text-fg-sub">
            {[ins.company, ins.policyNo && t('emergency.policy', { no: ins.policyNo })]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ))}
      {contacts.map((c) => call(c.name || t('profile.contacts'), '', c.phone))}
      {p.bloodType && (
        <p className="text-body-2 text-fg-sub">{t('emergency.blood', { type: p.bloodType })}</p>
      )}
    </section>
  );
}
