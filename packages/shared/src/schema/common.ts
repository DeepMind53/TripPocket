// 번들 크기를 줄이기 위해 zod/mini 사용 (트리셰이킹 가능한 함수형 API)
import * as z from 'zod/mini';
import { isLocalDate, LOCAL_TIME_RE } from '../date/localDate';

export const LocalDateSchema = z
  .string()
  .check(z.refine(isLocalDate, { message: '날짜는 YYYY-MM-DD 형식이어야 해요' }));

export const LocalTimeSchema = z
  .string()
  .check(z.regex(LOCAL_TIME_RE, '시간은 HH:mm 형식이어야 해요'));

export const IdSchema = z.uuid();
export const IsoDateTimeSchema = z.iso.datetime();

export const CoordsSchema = z.object({
  lat: z.number().check(z.gte(-90), z.lte(90)),
  lng: z.number().check(z.gte(-180), z.lte(180)),
});

/** 모든 동기화 엔티티 공통 필드 (docs/04 §1, docs/09 §6.2) */
export const baseFields = {
  id: IdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  deletedAt: z.optional(IsoDateTimeSchema),
  /** 서버가 부여하는 순번 (15단계) */
  rev: z.optional(z.number()),
};

export const nonEmpty = (max: number) =>
  z.string().check(z.trim(), z.minLength(1, '내용을 입력해 주세요'), z.maxLength(max));
