import { useState } from 'react';
import {
  disablePush,
  enablePush,
  pushSupport,
  PUSH_KINDS,
  setPushKind,
  usePush,
} from '../../data/push';
import { useTranslation } from '../../i18n';
import { Switch, toast } from '../../shared/ui';

/**
 * 설정 → 알림 (docs/20 G1, 사용자 요청 2026-10-25): 전체 켜기·끄기 + 필요한 종류만.
 * 기기마다 따로 (이 휴대폰에서 켠 알림만 이 휴대폰으로)
 */
export function NotificationGroup() {
  const { t } = useTranslation();
  const { enabled, prefs } = usePush();
  const [busy, setBusy] = useState(false);
  const support = pushSupport();

  return (
    <section aria-label={t('push.title')} className="flex flex-col gap-2">
      <h2 className="px-1 text-caption font-bold text-fg-muted">{t('push.title')}</h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-body-2 font-medium">{t('push.all')}</span>
            <span className="text-caption text-fg-muted">
              {support === 'ok' ? t('push.allDesc') : t(`push.support.${support}`)}
            </span>
          </span>
          <Switch
            label={t('push.all')}
            checked={enabled}
            disabled={busy || (support !== 'ok' && !enabled)}
            onCheckedChange={(on) => {
              setBusy(true);
              void (on ? enablePush() : disablePush().then(() => 'ok' as const))
                .then((r) => {
                  if (r === 'denied') toast(t('push.denied'));
                  else if (r === 'failed') toast(t('push.failed'));
                  else toast(t(on ? 'push.on' : 'push.off'));
                })
                .finally(() => setBusy(false));
            }}
          />
        </div>
        {/* 필요한 것만 — 전체가 꺼져 있으면 흐리게 */}
        <ul className={`flex flex-col gap-3 ${enabled ? '' : 'opacity-50'}`}>
          {PUSH_KINDS.map((k) => (
            <li key={k} className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-body-2">{t(`push.kind.${k}.name`)}</span>
                <span className="text-caption text-fg-muted">{t(`push.kind.${k}.desc`)}</span>
              </span>
              <Switch
                label={t(`push.kind.${k}.name`)}
                checked={prefs[k]}
                disabled={!enabled}
                onCheckedChange={(on) => void setPushKind(k, on)}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
