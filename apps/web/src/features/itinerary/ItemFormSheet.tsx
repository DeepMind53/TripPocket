import { useTrip } from '../../data/hooks';
import { isDomesticTrip } from '../../domain/tripPlace';
import { PlaceAutocomplete } from '../common/PlaceAutocomplete';
import { PlaceHours } from './PlaceHours';
import { useSettings } from '../../data/settingsStore';
import { ITEM_KINDS, type ItemKind, type ItineraryItem, type LocalDate } from '@trippocket/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { itemRepo } from '../../data/repositories/itemRepo';
import { BottomSheet, Button, Chip, TimeInput, toast } from '../../shared/ui';
import { KIND_ICON } from './itemKinds';

export interface ItemFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  /** 새로 추가할 날짜 (null = 가고 싶은 곳). 편집이면 무시 */
  date: LocalDate | null;
  /** 있으면 편집 */
  item?: ItineraryItem | undefined;
}

const inputClass =
  'h-12 w-full rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary';

/** S-11 일정 추가 · 편집 (직접 입력). 장소 검색 탭은 18단계 */
export function ItemFormSheet({ open, onOpenChange, tripId, date, item }: ItemFormSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(item ? 'form.editTitle' : 'form.addTitle')}
    >
      {/* 열릴 때마다 새 폼 (key로 초기화) */}
      {open && (
        <ItemForm
          key={item?.id ?? 'new'}
          tripId={tripId}
          date={date}
          item={item}
          onDone={() => onOpenChange(false)}
        />
      )}
    </BottomSheet>
  );
}

function ItemForm({
  tripId,
  date,
  item,
  onDone,
}: {
  tripId: string;
  date: LocalDate | null;
  item: ItineraryItem | undefined;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? 'place');
  const [title, setTitle] = useState(item?.title ?? '');
  const [startTime, setStartTime] = useState(item?.startTime ?? '');
  // 설정의 시간 입력 간격 (분 → 초)
  const timeStep = useSettings((st) => st.timeStepMin) * 60;
  const [endTime, setEndTime] = useState(item?.endTime ?? '');
  const [address, setAddress] = useState(item?.place?.address ?? '');
  // 검색에서 고른 장소 (좌표·제공자 id). 직접 고치면 이름·주소만 바뀐다
  const [picked, setPicked] = useState<PlaceRef | undefined>(item?.place);
  const trip = useTrip(tripId);
  const near = trip?.destinations.find((d) => d.coords)?.coords;
  const [memo, setMemo] = useState(item?.memo ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) {
      toast(t('form.needName'));
      return;
    }
    const link = url.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      toast(t('form.invalidUrl'));
      return;
    }
    // 빈 값은 필드를 아예 빼서 저장 (exactOptionalPropertyTypes)
    const optional = {
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(memo.trim() ? { memo: memo.trim() } : {}),
      ...(link ? { url: link } : {}),
    };
    const place = withAddress(picked, address.trim());
    setSaving(true);
    try {
      if (item) {
        // 비운 값은 undefined로 넘겨 저장소에서 지운다
        await itemRepo.update(item.id, {
          kind,
          title,
          startTime: optional.startTime,
          endTime: optional.endTime,
          memo: optional.memo,
          url: optional.url,
          place,
        });
        toast(t('form.saved'));
      } else {
        await itemRepo.create({
          tripId,
          date,
          kind,
          title,
          ...optional,
          ...(place ? { place } : {}),
        });
        toast(t('form.added'));
      }
      onDone();
    } catch {
      toast(t('form.failed'));
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset>
        <legend className="mb-2 text-caption font-semibold text-fg-sub">{t('form.kind')}</legend>
        <div className="flex flex-wrap gap-2">
          {ITEM_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <Chip
                key={k}
                selected={k === kind}
                onClick={() => setKind(k)}
                leading={<Icon aria-hidden="true" className="size-4" />}
              >
                {t(`kind.${k}`)}
              </Chip>
            );
          })}
        </div>
      </fieldset>

      <Field label={t('form.name')}>
        <input
          id="item-title"
          value={title}
          maxLength={100}
          placeholder={t('form.namePlaceholder')}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </Field>
      <PlaceAutocomplete
        query={title}
        domestic={trip ? isDomesticTrip(trip) : true}
        near={near}
        onPick={(p) => {
          setTitle(p.name);
          setAddress(p.address);
          setPicked({
            name: p.name,
            ...(p.address ? { address: p.address } : {}),
            ...(p.coords ? { coords: p.coords, coordsSource: p.source } : {}),
            ...(p.source === 'google'
              ? { googlePlaceId: p.id, coordsFetchedAt: new Date().toISOString() }
              : {}),
            ...(p.url && p.source !== 'google' ? { externalUrl: p.url } : {}),
          });
        }}
      />
      {picked?.googlePlaceId && (
        <PlaceHours
          googlePlaceId={picked.googlePlaceId}
          name={picked.name}
          date={date}
          time={startTime}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('form.start')}>
          <TimeInput id="item-start" step={timeStep} value={startTime} onChange={setStartTime} />
        </Field>
        <Field label={t('form.end')}>
          <TimeInput id="item-end" step={timeStep} value={endTime} onChange={setEndTime} />
        </Field>
      </div>

      <Field label={t('form.address')}>
        <input
          id="item-address"
          value={address}
          maxLength={200}
          placeholder={t('form.addressPlaceholder')}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label={t('form.memo')}>
        <textarea
          id="item-memo"
          value={memo}
          maxLength={2000}
          rows={3}
          onChange={(e) => setMemo(e.target.value)}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>

      <Field label={t('form.url')}>
        <input
          id="item-url"
          type="url"
          inputMode="url"
          value={url}
          placeholder="https://"
          onChange={(e) => setUrl(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Button type="submit" size="lg" fullWidth loading={saving}>
        {t(item ? 'form.save' : 'form.add')}
      </Button>
    </form>
  );
}

type PlaceRef = NonNullable<ItineraryItem['place']>;

/** 기존 장소 정보(좌표 등)는 유지하고 주소만 바꾼다. 남는 게 없으면 undefined */
function withAddress(place: PlaceRef | undefined, address: string): PlaceRef | undefined {
  const { address: _old, ...rest } = place ?? {};
  const next: PlaceRef = address ? { ...rest, address } : rest;
  return Object.keys(next).length > 0 ? next : undefined;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption font-semibold text-fg-sub">{label}</span>
      {children}
    </label>
  );
}
