import type { Settings } from '@trippocket/shared';
import type { ReactNode } from 'react';
import { resetSettings, updateSettings, useSettings } from '../../data/settingsStore';
import { useTranslation } from '../../i18n';
import { RadioList, SegmentedControl, Slider, Stepper, Switch, TopBar } from '../../shared/ui';
import { MapAppMark } from '../common/MapAppMark';

const FONT_SCALES = [0.9, 1, 1.15, 1.3] as const;

/**
 * S-23 설정 (docs/12 §3). 바꾸면 바로 적용, 저장 버튼 없음.
 * 컨트롤은 §3.1 원칙: 켜기/끄기 = 스위치, 2~4개 = 세그먼트, 설명 필요 = 라디오, 정해진 간격 숫자 = 스테퍼, 감각 조절 = 슬라이더
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const s = useSettings();
  const set =
    <K extends keyof Settings>(key: K) =>
    (value: Settings[K]) =>
      updateSettings({ [key]: value });
  const fontIndex = FONT_SCALES.indexOf(s.fontScale);

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('settings.title')} backTo="/me" />
      <div className="flex flex-col gap-6 px-5 pt-2">
        <Group
          title={t('settings.display')}
          onReset={() => resetSettings(['theme', 'fontScale', 'timeFormat', 'haptics'])}
        >
          <Field label={t('settings.theme')}>
            <SegmentedControl
              label={t('settings.theme')}
              value={s.theme}
              onChange={set('theme')}
              options={[
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
                { value: 'system', label: t('settings.themeSystem') },
              ]}
            />
          </Field>
          <Field
            label={t('settings.fontScale')}
            value={t(`settings.font.${fontIndex}` as 'settings.font.0')}
          >
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="text-caption">
                가
              </span>
              <div className="flex-1">
                <Slider
                  label={t('settings.fontScale')}
                  value={fontIndex}
                  min={0}
                  max={3}
                  step={1}
                  showTicks
                  onChange={(i) => updateSettings({ fontScale: FONT_SCALES[i] ?? 1 })}
                />
              </div>
              <span aria-hidden="true" className="text-title-2">
                가
              </span>
            </div>
            <p className="rounded-btn bg-bg-subtle px-3 py-2 text-body-2 text-fg-sub">
              {t('settings.fontPreview')}
            </p>
          </Field>
          <Field label={t('settings.timeFormat')}>
            <SegmentedControl
              label={t('settings.timeFormat')}
              value={s.timeFormat}
              onChange={set('timeFormat')}
              options={[
                { value: '24h', label: t('settings.time24') },
                { value: '12h', label: t('settings.time12') },
              ]}
            />
          </Field>
          <SwitchRow label={t('settings.haptics')} checked={s.haptics} onChange={set('haptics')} />
        </Group>

        <Group
          title={t('settings.maps')}
          onReset={() => resetSettings(['directionsApp', 'travelMode'])}
        >
          <Field label={t('settings.directionsApp')}>
            <RadioList
              label={t('settings.directionsApp')}
              value={s.directionsApp}
              onChange={set('directionsApp')}
              options={[
                { value: 'naver', label: t('dir.naver'), icon: <MapAppMark app="naver" /> },
                { value: 'google', label: t('dir.google'), icon: <MapAppMark app="google" /> },
                { value: 'kakao', label: t('dir.kakao'), icon: <MapAppMark app="kakao" /> },
                { value: 'ask', label: t('settings.askEveryTime') },
              ]}
            />
          </Field>
          <Field label={t('settings.travelMode')}>
            <SegmentedControl
              label={t('settings.travelMode')}
              value={s.travelMode}
              onChange={set('travelMode')}
              options={[
                { value: 'transit', label: t('dir.transit') },
                { value: 'walk', label: t('dir.walk') },
                { value: 'car', label: t('dir.car') },
              ]}
            />
          </Field>
        </Group>

        <Group
          title={t('settings.plan')}
          onReset={() => resetSettings(['timeStepMin', 'dimPastItems'])}
        >
          <Field label={t('settings.timeStep')}>
            <SegmentedControl
              label={t('settings.timeStep')}
              value={String(s.timeStepMin) as '5' | '10' | '15' | '30'}
              onChange={(v) =>
                updateSettings({ timeStepMin: Number(v) as Settings['timeStepMin'] })
              }
              options={(['5', '10', '15', '30'] as const).map((v) => ({
                value: v,
                label: t('settings.minutes', { n: v }),
              }))}
            />
          </Field>
          <SwitchRow
            label={t('settings.dimPast')}
            checked={s.dimPastItems}
            onChange={set('dimPastItems')}
          />
        </Group>

        <Group
          title={t('settings.fx')}
          onReset={() => resetSettings(['fxFeeEnabled', 'fxFeePercent'])}
        >
          <SwitchRow
            label={t('settings.fxFee')}
            checked={s.fxFeeEnabled}
            onChange={set('fxFeeEnabled')}
          />
          {s.fxFeeEnabled && (
            <label className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-body-2 font-medium">{t('settings.fxFeePercent')}</span>
                <span className="text-caption text-fg-muted">{t('settings.fxFeeDesc')}</span>
              </span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={10}
                  step={0.05}
                  defaultValue={s.fxFeePercent}
                  onBlur={(e) => {
                    // 범위 밖·잘못된 값은 가까운 올바른 값으로 (docs/12 §4 NumberInput)
                    const v = Math.min(
                      10,
                      Math.max(0, Math.round(Number(e.target.value) * 20) / 20),
                    );
                    const next = Number.isFinite(v) ? v : 1.75;
                    e.target.value = String(next);
                    updateSettings({ fxFeePercent: next });
                  }}
                  className="tabular h-11 w-20 rounded-btn bg-bg-subtle px-2 text-right text-body-1"
                />
                <span className="text-body-2">%</span>
              </span>
            </label>
          )}
        </Group>

        <Group title={t('settings.data')} onReset={() => resetSettings(['backupReminderDays'])}>
          <div className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-body-2 font-medium">{t('settings.backupReminder')}</span>
              <span className="text-caption text-fg-muted">{t('settings.backupReminderDesc')}</span>
            </span>
            <Stepper
              label={t('settings.backupReminder')}
              value={s.backupReminderDays}
              onChange={set('backupReminderDays')}
              min={0}
              max={56}
              step={7}
              format={(n) => (n === 0 ? t('settings.off') : t('settings.days', { n }))}
            />
          </div>
        </Group>

        <Group title={t('settings.language')}>
          <RadioList
            label={t('settings.language')}
            value={s.language}
            onChange={set('language')}
            options={[
              { value: 'ko', label: '한국어' },
              {
                value: 'en',
                label: 'English',
                description: t('settings.comingSoon'),
                disabled: true,
              },
            ]}
          />
        </Group>
      </div>
    </div>
  );
}

function Group({
  title,
  onReset,
  children,
}: {
  title: string;
  onReset?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="px-1 text-caption font-bold text-fg-muted">{title}</h2>
      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-4">
        {children}
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="self-end px-1 py-1 text-caption font-semibold text-fg-sub"
        >
          {t('settings.reset')}
        </button>
      )}
    </section>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-body-2 font-medium">{label}</span>
        {value && <span className="text-caption font-semibold text-primary">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-body-2 font-medium">{label}</span>
      <Switch label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
