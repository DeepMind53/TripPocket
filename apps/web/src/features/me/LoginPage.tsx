import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { loginProviders } from '../../data/authStore';
import { useTranslation } from '../../i18n';
import { copyText } from '../../shared/lib/clipboard';
import { Spinner, TopBar } from '../../shared/ui';

const STYLE: Record<string, { bg: string; fg: string; border?: string }> = {
  kakao: { bg: '#FEE500', fg: '#191919' },
  naver: { bg: '#03C75A', fg: '#FFFFFF' },
  google: { bg: '#FFFFFF', fg: '#1F1F1F', border: '#DADCE0' },
};

/**
 * S-20 로그인 — 소셜 로그인만 (비밀번호 없음, docs/09 §4.1).
 * 로그인은 동기화용 — 안 해도 앱은 전부 동작한다
 */
export function LoginPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [providers, setProviders] = useState<string[] | null | undefined>(undefined);
  const error = params.get('error');
  const account = params.get('account');
  const returnTo = params.get('returnTo') ?? '/me';

  useEffect(() => {
    void loginProviders().then(setProviders);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <TopBar title={t('login.title')} backTo="/me" />
      <div className="flex flex-1 flex-col gap-4 px-5 pt-4">
        <p className="text-body-2 text-fg-sub">{t('login.why')}</p>
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-card bg-warning/15 p-3 text-body-2"
          >
            {t(
              `login.error.${error === 'invite' || error === 'cancelled' || error === 'provider' ? error : 'state'}`,
            )}
            {error === 'invite' && account && (
              <button
                type="button"
                onClick={() => void copyText(account, t('login.copied'))}
                className="self-start rounded-btn bg-surface px-2 py-1 font-mono text-caption"
              >
                {account}
              </button>
            )}
          </div>
        )}
        {providers === undefined ? (
          <Spinner />
        ) : providers === null || providers.length === 0 ? (
          <p className="rounded-card bg-bg-subtle p-4 text-body-2 text-fg-sub">
            {t('login.unavailable')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {providers.map((p) => {
              const s = STYLE[p] ?? STYLE.google!;
              return (
                // 전체 화면 이동: 서버 → 제공자 로그인 → 서버 콜백 → 앱으로 돌아옴
                <a
                  key={p}
                  href={`/auth/${p}/start?returnTo=${encodeURIComponent(returnTo)}`}
                  className="flex h-12 items-center justify-center rounded-btn text-body-1 font-semibold"
                  style={{
                    background: s.bg,
                    color: s.fg,
                    border: s.border ? `1px solid ${s.border}` : undefined,
                  }}
                >
                  {t(`login.with.${p}` as 'login.with.kakao')}
                </a>
              );
            })}
          </div>
        )}
        <p className="mt-auto pb-6 text-caption text-fg-muted">{t('login.privacy')}</p>
      </div>
    </div>
  );
}
