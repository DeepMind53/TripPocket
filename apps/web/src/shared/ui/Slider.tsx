import * as RadixSlider from '@radix-ui/react-slider';

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  /** 눈금 표시 (단계가 적을 때, 예: 글자 크기 4단계) */
  showTicks?: boolean;
}

/** 연속 범위 조절 (docs/12 §3.1). 키보드 ←→로도 조절 가능 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  showTicks = false,
}: SliderProps) {
  const tickCount = showTicks ? Math.round((max - min) / step) + 1 : 0;
  return (
    <RadixSlider.Root
      value={[value]}
      onValueChange={([v]) => {
        if (v !== undefined) onChange(v);
      }}
      min={min}
      max={max}
      step={step}
      className="relative flex h-11 w-full touch-none items-center select-none"
    >
      <RadixSlider.Track className="relative h-1.5 grow rounded-full bg-line">
        <RadixSlider.Range className="absolute h-full rounded-full bg-primary" />
      </RadixSlider.Track>
      {showTicks && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[14px] flex justify-between"
        >
          {Array.from({ length: tickCount }, (_, i) => (
            <span key={i} className="size-1.5 rounded-full bg-fg-muted/50" />
          ))}
        </div>
      )}
      <RadixSlider.Thumb
        aria-label={label}
        className="block size-7 rounded-full border border-line bg-white shadow-[0_1px_4px_rgb(0_0_0/0.25)]"
      />
    </RadixSlider.Root>
  );
}
