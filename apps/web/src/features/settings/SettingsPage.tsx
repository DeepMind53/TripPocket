import { ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../data/authStore';
import {
  clearUserDefaults,
  saveUserDefaults,
  userDefaults,
  useSettings,
} from '../../data/settingsStore';
import { useTranslation } from '../../i18n';
import { Button, toast, TopBar } from '../../shared/ui';
import {
  SECTION_HEADS,
  SETTINGS_SECTIONS,
  searchSettings,
  type SettingsSection,
} from './settingsSections';

/**
 * S-23 설정 첫 화면 (docs/12 §3, 사용자 요청 2026-11-14 "설정이 너무 길다"):
 * 위에 설정 검색, 아래에 묶음 목록 — 누르면 `/settings/:section`에서 그 묶음만.
 * 검색은 기기 안에서만, 결과를 누르면 그 항목으로 가서 잠깐 강조
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const s = useSettings();
  const signedIn = !!useAuth((a) => a.me);
  const [q, setQ] = useState('');
  const sections = SETTINGS_SECTIONS.filter((x) => !x.signedIn || signedIn);
  const label = (key: string) => t(key as 'settings.title');
  const results = searchSettings(q, sections, label);

  const row = (x: SettingsSection, item: string | null, i: number) => {
    const on = x.plan?.filter((k) => s[k]).length ?? 0;
    return (
      <li key={`${x.id}-${item ?? ''}-${i}`}>
        <Link
          to={`/settings/${x.id}`}
          state={item ? { find: item } : undefined}
          className="flex min-h-12 items-center gap-2 px-4 py-2"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-2 font-medium break-keep">{item ?? label(x.title)}</span>
            {item && <span className="text-caption text-fg-muted">{label(x.title)}</span>}
          </span>
          {!item && x.plan && (
            <span className="tabular shrink-0 text-caption text-fg-muted">
              {t('settings.onCount', { total: x.plan.length, on })}
            </span>
          )}
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
        </Link>
      </li>
    );
  };
  const list = 'divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface';

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('settings.title')} backTo="/me" />
      <div className="flex flex-col gap-6 px-5 pt-2">
        <div className="flex flex-col gap-2">
          <p className="px-1 text-caption text-fg-muted">{t('settings.synced')}</p>
          <label className="flex h-12 items-center gap-2 rounded-btn bg-bg-subtle px-3">
            <Search aria-hidden="true" className="size-[18px] shrink-0 text-fg-muted" />
            <input
              type="search"
              aria-label={t('settings.search')}
              placeholder={t('settings.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-body-1 outline-none"
            />
          </label>
        </div>

        {q.trim() ? (
          results.length ? (
            <ul aria-label={t('settings.search')} className={list}>
              {results.map((r, i) => row(r.section, r.label, i))}
            </ul>
          ) : (
            <p role="status" className="py-6 text-center text-body-2 text-fg-muted">
              {t('settings.searchNone')}
            </p>
          )
        ) : (
          <>
            {SECTION_HEADS.map((head) => (
              <section
                key={head}
                aria-label={t(`settings.head.${head}`)}
                className="flex flex-col gap-2"
              >
                <h2 className="px-1 text-caption font-semibold text-fg-muted">
                  {t(`settings.head.${head}`)}
                </h2>
                <ul className={list}>
                  {sections.filter((x) => x.head === head).map((x, i) => row(x, null, i))}
                </ul>
              </section>
            ))}
            <DefaultsBox />
          </>
        )}
      </div>
    </div>
  );
}

/** 지금 설정을 기본값으로 저장 → 섹션별 [기본값으로 되돌리기]가 이 값으로 (사용자 요청 2026-11-03) */
function DefaultsBox() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(() => userDefaults() !== null);
  return (
    <section
      aria-label={t('settings.saveDefaults')}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4"
    >
      <Button
        fullWidth
        variant="secondary"
        onClick={() => {
          saveUserDefaults();
          setSaved(true);
          toast(t('settings.savedDefaults'));
        }}
      >
        {t('settings.saveDefaults')}
      </Button>
      <p className="text-caption whitespace-pre-line text-fg-muted">
        {t('settings.saveDefaultsDesc')}
      </p>
      {saved && (
        <button
          type="button"
          onClick={() => {
            clearUserDefaults();
            setSaved(false);
            toast(t('settings.clearedDefaults'));
          }}
          className="self-end px-1 py-1 text-caption font-semibold text-fg-sub"
        >
          {t('settings.clearDefaults')}
        </button>
      )}
    </section>
  );
}
