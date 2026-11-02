import { X } from 'lucide-react';
import { useState } from 'react';
import { CUSTOM_FOODS_MAX, updateTravelProfile, useTravelProfile } from '../../data/travelProfile';
import { useTranslation } from '../../i18n';
import { Button, IconButton, SegmentedControl } from '../../shared/ui';

const field = 'h-12 w-full min-w-0 rounded-btn bg-bg-subtle px-3 text-body-1';

/**
 * 알레르기·비선호 음식 직접 추가 (사용자 요청 2026-11-02): 한글·영어로 적으면 건강 카드에 그대로 보인다.
 * 한국어 카드엔 한글, 다른 언어 카드엔 영어 (번역이 없어서)
 */
export function CustomFoodsField() {
  const { t } = useTranslation();
  const list = useTravelProfile((p) => p.customFoods);
  const [ko, setKo] = useState('');
  const [en, setEn] = useState('');
  const [kind, setKind] = useState<'allergy' | 'dislike'>('allergy');
  const canAdd = (ko.trim() || en.trim()) && list.length < CUSTOM_FOODS_MAX;
  const add = () => {
    if (!canAdd) return;
    updateTravelProfile({ customFoods: [...list, { ko: ko.trim(), en: en.trim(), kind }] });
    setKo('');
    setEn('');
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-semibold text-fg-sub">{t('profile.customFoods')}</p>
      {list.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
          {list.map((c, i) => (
            <li key={`${c.ko}-${c.en}-${i}`} className="flex items-center gap-2 py-1 pr-1 pl-3">
              <span
                className={`shrink-0 rounded px-1.5 text-micro font-semibold ${c.kind === 'allergy' ? 'bg-danger/10 text-danger' : 'bg-bg-subtle text-fg-sub'}`}
              >
                {t(c.kind === 'allergy' ? 'profile.kindAllergy' : 'profile.kindDislike')}
              </span>
              <span className="min-w-0 flex-1 truncate text-body-2">
                {[c.ko, c.en].filter(Boolean).join(' · ')}
              </span>
              <IconButton
                label={t('profile.remove')}
                icon={<X />}
                onClick={() => updateTravelProfile({ customFoods: list.filter((_, j) => j !== i) })}
              />
            </li>
          ))}
        </ul>
      )}
      <SegmentedControl
        label={t('profile.customKind')}
        value={kind}
        onChange={setKind}
        options={[
          { value: 'allergy', label: t('profile.kindAllergy') },
          { value: 'dislike', label: t('profile.kindDislike') },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          aria-label={t('profile.customKo')}
          placeholder={t('profile.customKo')}
          maxLength={40}
          className={field}
          value={ko}
          onChange={(e) => setKo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input
          aria-label={t('profile.customEn')}
          placeholder={t('profile.customEn')}
          maxLength={40}
          lang="en"
          className={field}
          value={en}
          onChange={(e) => setEn(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
      </div>
      <Button variant="secondary" disabled={!canAdd} onClick={add}>
        {t('profile.addCustom')}
      </Button>
      <p className="text-micro whitespace-pre-line text-fg-muted">{t('profile.customHint')}</p>
    </div>
  );
}
