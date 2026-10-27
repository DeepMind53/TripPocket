import { useTravelProfile, updateTravelProfile } from '../../data/travelProfile';
import { useTranslation } from '../../i18n';
import { SegmentedControl, TopBar } from '../../shared/ui';

/**
 * 마이 → 개인정보 (사용자 요청 2026-10-27): 여권 만료일처럼 여행에 필요하지만 신상·보안과 관련 없는 정보.
 * 고치면 바로 저장(설정과 같은 방식, docs/12 §3.1). 이 기기에만 — 서버·백업으로 보내지 않는다
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const p = useTravelProfile();
  const field = 'h-12 rounded-btn bg-bg-subtle px-3 text-body-1';
  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('profile.title')} backTo="/me" />
      <div className="flex flex-col gap-5 px-5 pt-2">
        <p className="rounded-card bg-bg-subtle p-3 text-caption whitespace-pre-line text-fg-sub">
          {t('profile.desc')}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-fg-sub">{t('profile.passport')}</span>
          <input
            type="date"
            className={field}
            value={p.passportExpiry ?? ''}
            onChange={(e) => updateTravelProfile({ passportExpiry: e.target.value || null })}
          />
          <span className="text-micro text-fg-muted">{t('profile.passportHint')}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-fg-sub">{t('profile.license')}</span>
          <input
            type="date"
            className={field}
            value={p.licenseExpiry ?? ''}
            onChange={(e) => updateTravelProfile({ licenseExpiry: e.target.value || null })}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-fg-sub">{t('profile.seat')}</span>
          <SegmentedControl
            label={t('profile.seat')}
            value={p.seat}
            onChange={(seat) => updateTravelProfile({ seat })}
            options={[
              { value: 'window', label: t('profile.seatWindow') },
              { value: 'aisle', label: t('profile.seatAisle') },
              { value: 'any', label: t('profile.seatAny') },
            ]}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-fg-sub">{t('profile.food')}</span>
          <input
            className={field}
            value={p.food}
            maxLength={200}
            placeholder={t('profile.foodPlaceholder')}
            onChange={(e) => updateTravelProfile({ food: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-fg-sub">{t('profile.memo')}</span>
          <textarea
            className={`${field} h-auto py-2`}
            rows={3}
            value={p.memo}
            maxLength={500}
            placeholder={t('profile.memoPlaceholder')}
            onChange={(e) => updateTravelProfile({ memo: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
