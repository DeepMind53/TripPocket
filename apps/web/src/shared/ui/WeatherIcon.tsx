import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';
import type { WeatherKind } from '../../domain/weather';
import { cn } from '../lib/cn';

const ICONS: Record<WeatherKind, [LucideIcon, string]> = {
  sun: [Sun, 'text-rating'],
  partly: [CloudSun, 'text-rating'],
  cloud: [Cloud, 'text-fg-muted'],
  fog: [CloudFog, 'text-fg-muted'],
  drizzle: [CloudDrizzle, 'text-primary'],
  rain: [CloudRain, 'text-primary'],
  snow: [CloudSnow, 'text-primary'],
  storm: [CloudLightning, 'text-warning'],
  unknown: [Thermometer, 'text-fg-muted'],
};

/** 날씨 선 그림 (이모지 대신, 색 하나) */
export function WeatherIcon({ kind, className }: { kind: WeatherKind; className?: string }) {
  const [Icon, color] = ICONS[kind];
  return <Icon aria-hidden="true" strokeWidth={2.25} className={cn(color, className)} />;
}
