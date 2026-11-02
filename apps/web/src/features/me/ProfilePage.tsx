import {
  ALLERGEN_KO,
  ALLERGENS,
  BLOOD_TYPES,
  ENTRY_PERMITS,
  type Allergen,
} from '@trippocket/shared';
import { Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  CONTACTS_MAX,
  MEMBERSHIPS_MAX,
  updateTravelProfile,
  useTravelProfile,
} from '../../data/travelProfile';
import { useTranslation } from '../../i18n';
import { CustomFoodsField } from './CustomFoodsField';
import { TranslateCardsButton } from './TranslateCardsButton';
import { Chip, IconButton, SegmentedControl, TopBar } from '../../shared/ui';

const field = 'h-12 w-full min-w-0 rounded-btn bg-bg-subtle px-3 text-body-1';

/**
 * 마이 → 개인정보 (사용자 요청 2026-10-27, 항목 추가 2026-11-02): 여행에 필요하지만 신상·보안과 관련 없는 정보.
 * 고치면 바로 저장(설정과 같은 방식, docs/12 §3.1). 이 기기에만 — 서버·백업으로 보내지 않는다.
 * 쓰는 곳: 여권·허가 → 필수 항목, 회원번호 → 항공 예약 카드, 보험·연락처 → 긴급 연락처, 알레르기 → 회화의 건강 카드
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const p = useTravelProfile();
  const toggleAllergen = (a: Allergen) =>
    updateTravelProfile({
      allergens: p.allergens.includes(a)
        ? p.allergens.filter((x) => x !== a)
        : ALLERGENS.filter((x) => x === a || p.allergens.includes(x)),
    });
  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('profile.title')} backTo="/me" />
      <div className="flex flex-col gap-7 px-5 pt-2">
        <p className="rounded-card bg-bg-subtle p-3 text-caption whitespace-pre-line text-fg-sub">
          {t('profile.desc')}
        </p>

        <Group title={t('profile.groupDocs')}>
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
          <p className="text-caption font-semibold text-fg-sub">{t('profile.permits')}</p>
          <div className="grid grid-cols-2 gap-3 tight:grid-cols-1">
            {ENTRY_PERMITS.map((k) => (
              <label key={k} className="flex min-w-0 flex-col gap-1.5">
                <span className="text-caption text-fg-sub">{t(`profile.permit.${k}`)}</span>
                <input
                  type="date"
                  className={field}
                  value={p.permits[k] ?? ''}
                  onChange={(e) => {
                    const next = { ...p.permits };
                    if (e.target.value) next[k] = e.target.value;
                    else delete next[k];
                    updateTravelProfile({ permits: next });
                  }}
                />
              </label>
            ))}
          </div>
          <p className="-mt-2 text-micro whitespace-pre-line text-fg-muted">
            {t('profile.permitsHint')}
          </p>
        </Group>

        <Group title={t('profile.groupFlight')}>
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
          <p className="text-caption font-semibold text-fg-sub">{t('profile.memberships')}</p>
          {p.memberships.map((m, i) => {
            const set = (patch: Partial<typeof m>) =>
              updateTravelProfile({
                memberships: p.memberships.map((x, j) => (j === i ? { ...x, ...patch } : x)),
              });
            return (
              <div key={i} className="flex flex-col gap-2 rounded-card border border-line p-3">
                <div className="flex items-center gap-2">
                  <input
                    aria-label={t('profile.airline')}
                    placeholder={t('profile.airlinePlaceholder')}
                    maxLength={40}
                    className={field}
                    value={m.airline}
                    onChange={(e) => set({ airline: e.target.value })}
                  />
                  <IconButton
                    label={t('profile.remove')}
                    icon={<X />}
                    onClick={() =>
                      updateTravelProfile({
                        memberships: p.memberships.filter((_, j) => j !== i),
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-2">
                  <input
                    aria-label={t('profile.memberNo')}
                    placeholder={t('profile.memberNo')}
                    maxLength={30}
                    className={`${field} tabular`}
                    value={m.number}
                    onChange={(e) => set({ number: e.target.value })}
                  />
                  <input
                    aria-label={t('profile.tier')}
                    placeholder={t('profile.tier')}
                    maxLength={30}
                    className={field}
                    value={m.tier}
                    onChange={(e) => set({ tier: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
          {p.memberships.length < MEMBERSHIPS_MAX && (
            <AddButton
              label={t('profile.addMembership')}
              onClick={() =>
                updateTravelProfile({
                  memberships: [...p.memberships, { airline: '', number: '', tier: '' }],
                })
              }
            />
          )}
          <p className="-mt-2 text-micro text-fg-muted">{t('profile.membershipsHint')}</p>
        </Group>

        <Group title={t('profile.groupSafety')}>
          <p className="text-caption font-semibold text-fg-sub">{t('profile.insurance')}</p>
          <div className="grid grid-cols-2 gap-2 tight:grid-cols-1">
            <input
              aria-label={t('profile.insCompany')}
              placeholder={t('profile.insCompany')}
              maxLength={40}
              className={field}
              value={p.insurance.company}
              onChange={(e) =>
                updateTravelProfile({ insurance: { ...p.insurance, company: e.target.value } })
              }
            />
            <input
              aria-label={t('profile.insPolicy')}
              placeholder={t('profile.insPolicy')}
              maxLength={40}
              className={`${field} tabular`}
              value={p.insurance.policyNo}
              onChange={(e) =>
                updateTravelProfile({ insurance: { ...p.insurance, policyNo: e.target.value } })
              }
            />
          </div>
          <input
            aria-label={t('profile.insPhone')}
            placeholder={t('profile.insPhone')}
            type="tel"
            maxLength={30}
            className={`${field} tabular`}
            value={p.insurance.phone}
            onChange={(e) =>
              updateTravelProfile({ insurance: { ...p.insurance, phone: e.target.value } })
            }
          />
          <p className="text-caption font-semibold text-fg-sub">{t('profile.contacts')}</p>
          {p.contacts.map((c, i) => {
            const set = (patch: Partial<typeof c>) =>
              updateTravelProfile({
                contacts: p.contacts.map((x, j) => (j === i ? { ...x, ...patch } : x)),
              });
            return (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-2"
              >
                <input
                  aria-label={t('profile.contactName')}
                  placeholder={t('profile.contactName')}
                  maxLength={30}
                  className={field}
                  value={c.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
                <input
                  aria-label={t('profile.contactPhone')}
                  placeholder={t('profile.contactPhone')}
                  type="tel"
                  maxLength={30}
                  className={`${field} tabular`}
                  value={c.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
                <IconButton
                  label={t('profile.remove')}
                  icon={<X />}
                  onClick={() =>
                    updateTravelProfile({ contacts: p.contacts.filter((_, j) => j !== i) })
                  }
                />
              </div>
            );
          })}
          {p.contacts.length < CONTACTS_MAX && (
            <AddButton
              label={t('profile.addContact')}
              onClick={() =>
                updateTravelProfile({ contacts: [...p.contacts, { name: '', phone: '' }] })
              }
            />
          )}
          <p className="-mt-2 text-micro text-fg-muted">{t('profile.safetyHint')}</p>
        </Group>

        <Group title={t('profile.groupHealth')}>
          <p className="text-caption font-semibold text-fg-sub">{t('profile.allergens')}</p>
          <div role="group" aria-label={t('profile.allergens')} className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <Chip
                key={a}
                aria-pressed={p.allergens.includes(a)}
                selected={p.allergens.includes(a)}
                onClick={() => toggleAllergen(a)}
              >
                {ALLERGEN_KO[a]}
              </Chip>
            ))}
          </div>
          {/* "그 밖에 못 먹는 음식" 대신 알레르기·비선호 음식을 한글·영어로 직접 추가 (2026-11-02) */}
          <CustomFoodsField />
          <p className="text-caption font-semibold text-fg-sub">{t('profile.blood')}</p>
          <div role="group" aria-label={t('profile.blood')} className="flex flex-wrap gap-2">
            {BLOOD_TYPES.map((b) => (
              <Chip
                key={b}
                aria-pressed={p.bloodType === b}
                selected={p.bloodType === b}
                onClick={() => updateTravelProfile({ bloodType: p.bloodType === b ? null : b })}
              >
                {b}
              </Chip>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-fg-sub">{t('profile.meds')}</span>
            <input
              className={field}
              value={p.meds}
              maxLength={200}
              placeholder={t('profile.medsPlaceholder')}
              // 약을 고치면 예전 번역은 맞지 않으므로 지운다
              onChange={(e) => updateTravelProfile({ meds: e.target.value, medsTr: {} })}
            />
          </label>
          <p className="-mt-2 text-micro whitespace-pre-line text-fg-muted">
            {t('profile.healthHint')}
          </p>
          <TranslateCardsButton />
        </Group>

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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-body-1 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center justify-center gap-1 rounded-btn border border-dashed border-line text-body-2 font-semibold text-primary"
    >
      <Plus aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
