import { Ruler } from 'lucide-react';
import { useState } from 'react';
import { useLab } from '../../data/labsStore';
import { convertUnit, type UnitKind } from '../../domain/labTools';
import { useTranslation } from '../../i18n';
import { BottomSheet, Chip } from '../../shared/ui';

const KINDS: UnitKind[] = ['temp', 'length', 'weight', 'height'];

/**
 * 단위 바꾸기 (실험실 unitConvert, 2026-11-13, 빠른 메뉴): 미국·영국 여행에서 °F·마일·파운드·인치를
 * 우리 단위로 (반대로도). 기기 안 계산만
 */
export function UnitConverter() {
  const { t } = useTranslation();
  const on = useLab('unitConvert');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<UnitKind>('temp');
  const [toMetric, setToMetric] = useState(true);
  const [value, setValue] = useState('');
  if (!on) return null;
  const n = Number(value);
  const out =
    value.trim() && Number.isFinite(n)
      ? convertUnit(kind, n, toMetric ? 'toMetric' : 'fromMetric')
      : null;
  const from = t(`tool.unit.${kind}.${toMetric ? 'us' : 'metric'}`);
  const to = t(`tool.unit.${kind}.${toMetric ? 'metric' : 'us'}`);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 items-center gap-2 rounded-card bg-bg-subtle px-3 text-left"
      >
        <Ruler aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <span className="flex-1 text-body-2 font-semibold">{t('tool.unitTitle')}</span>
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title={t('tool.unitTitle')}>
        <div className="flex flex-col gap-3 pb-2">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Chip key={k} selected={k === kind} onClick={() => setKind(k)}>
                {t(`tool.unit.${k}.name`)}
              </Chip>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <input
              value={value}
              inputMode="decimal"
              aria-label={from}
              placeholder="0"
              onChange={(e) => setValue(e.target.value.replace(/[^\d.-]/g, '').slice(0, 10))}
              className="tabular h-12 min-w-0 flex-1 rounded-btn border border-line bg-bg-subtle px-3 text-title-2 outline-none focus:border-primary"
            />
            <span className="w-14 shrink-0 text-body-2 text-fg-sub">{from}</span>
          </label>
          <button
            type="button"
            onClick={() => setToMetric(!toMetric)}
            className="self-start rounded-full px-3 py-1 text-caption font-medium text-primary active:bg-primary-weak"
          >
            {t('tool.unitSwap')}
          </button>
          <p aria-live="polite" className="tabular text-title-1 font-semibold">
            {out === null ? '—' : `${out} ${to}`}
          </p>
        </div>
      </BottomSheet>
    </>
  );
}
