import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { loginProviders, useAuth } from '../../data/authStore';
import { useTranslation } from '../../i18n';
import { copyText } from '../../shared/lib/clipboard';
import { BottomSheet, Button, Spinner, TopBar } from '../../shared/ui';

const STYLE: Record<string, { bg: string; fg: string; border?: string }> = {
  kakao: { bg: '#FEE500', fg: '#191919' },
  naver: { bg: '#03C75A', fg: '#FFFFFF' },
  google: { bg: '#FFFFFF', fg: '#1F1F1F', border: '#DADCE0' },
};

const KNOWN_ERRORS = ['invite', 'cancelled', 'provider', 'pending', 'rejected', 'disabled'];

/**
 * S-20 로그인 — 소셜 로그인만 (비밀번호 없음, docs/09 §4.1).
 * 로그인한 사람만 앱을 쓴다 (app/AuthGate.tsx) — 로그인 전에는 돌아갈 화면이 없으므로 뒤로·홈 버튼을 숨긴다
 */
export function LoginPage({ returnTo: gateReturn }: { returnTo?: string } = {}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [providers, setProviders] = useState<string[] | null | undefined>(undefined);
  const error = params.get('error');
  const account = params.get('account');
  // 로그인 확인(AuthGate)이 대신 보여 줄 때는 지금 주소로 돌아온다
  const returnTo = gateReturn ?? params.get('returnTo') ?? '/me';
  const signedIn = useAuth((s) => s.status === 'user');
  // 네이버 로그인 앱은 아직 "개발 중" — 관리자가 네이버 콘솔에 등록한 아이디만 로그인된다 (누르면 먼저 안내)
  const [naverNotice, setNaverNotice] = useState(false);
  const startUrl = (p: string) => `/auth/${p}/start?returnTo=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    void loginProviders().then(setProviders);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <TopBar title={t('login.title')} {...(signedIn ? { backTo: '/me' } : {})} />
      <div className="flex flex-1 flex-col gap-4 px-5 pt-4">
        <p className="text-body-2 text-fg-sub">{t('login.why')}</p>
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-card bg-warning/15 p-3 text-body-2"
          >
            {t(
              `login.error.${KNOWN_ERRORS.includes(error) ? error : 'state'}` as 'login.error.state',
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
                  href={startUrl(p)}
                  onClick={(e) => {
                    if (p !== 'naver') return;
                    e.preventDefault();
                    setNaverNotice(true);
                  }}
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
        <BottomSheet
          open={naverNotice}
          onOpenChange={setNaverNotice}
          title={t('login.naverNotice.title')}
          description={t('login.naverNotice.desc')}
          footer={
            <div className="flex flex-col gap-2">
              <Button size="lg" fullWidth onClick={() => window.location.assign(startUrl('naver'))}>
                {t('login.naverNotice.continue')}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setNaverNotice(false)}>
                {t('login.naverNotice.other')}
              </Button>
            </div>
          }
        >
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body-2 text-fg-sub">
            <li>{t('login.naverNotice.step1')}</li>
            <li>{t('login.naverNotice.step2')}</li>
            <li>{t('login.naverNotice.step3')}</li>
          </ul>
        </BottomSheet>
      </div>
    </div>
  );
}
