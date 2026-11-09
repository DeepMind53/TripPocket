import { Navigation, TrainFront } from 'lucide-react';
import { useState } from 'react';
import {
  DayLineTabs,
  GateProgress,
  NextStopCard,
  RouteBar,
  RouteLine,
  RouteStop,
  Stamp,
  TicketCard,
  TransferChip,
  toast,
} from '../../shared/ui';

/**
 * 디자인 개편 "여행 노선" 공통 부품 견본 (개발 전용, docs/29 §13 1단계).
 * 라이트·다크·좁은 화면·큰 글자에서 위 테마 버튼과 브라우저 폭으로 확인한다
 */
export function RouteSamples() {
  const [day, setDay] = useState('d2');
  const [dense, setDense] = useState(false);
  const copy = () => toast('예약번호를 복사했어요');
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-body-2 font-semibold text-fg-sub">일차 알약 · 노선 막대</h3>
        <DayLineTabs
          label="일차"
          value={day}
          onChange={setDay}
          items={[
            { value: 'all', label: '전체', dayIndex: null },
            ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
              value: `d${i + 1}`,
              label: `${i + 1}일`,
              sub: `11.${24 + i}`,
              dayIndex: i,
              today: i === 1,
            })),
            { value: 'wish', label: '가고 싶은 곳', dayIndex: null },
          ]}
        />
        <RouteBar days={4} todayIndex={1} pastBefore={1} label="4일 중 2일차" />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center justify-between text-body-2 font-semibold text-fg-sub">
          노선 (2일차)
          <button
            type="button"
            className="text-caption text-primary"
            onClick={() => setDense((d) => !d)}
          >
            {dense ? '보통으로' : '촘촘히'}
          </button>
        </h3>
        <RouteLine label="2일차 노선" dayIndex={1}>
          <RouteStop
            number={1}
            state="past"
            mark="visited"
            title="츠키지 장외시장"
            meta="맛집 · 주오구"
            time="09:30"
            dense={dense}
          />
          <TransferChip past>850m · 길찾기</TransferChip>
          <RouteStop
            number={2}
            state="past"
            mark="skipped"
            title="하마리큐 정원"
            meta="관광 · 입장 300엔"
            time="11:30"
            dense={dense}
          />
          <TransferChip past icon={<TrainFront />}>
            6.2km · 길찾기
          </TransferChip>
          <RouteStop
            number={3}
            state="next"
            title="센소지"
            meta="다음 · 38분 뒤"
            time="14:00"
            dense={dense}
            onClick={() => toast('상세 시트')}
            aria-label="센소지 14시"
          />
          <RouteStop title="나카미세 거리에서 기념품" meta="메모" dense={dense} />
          <TransferChip>1.4km · 길찾기</TransferChip>
          <RouteStop
            number={4}
            title="도쿄 스카이트리 전망대 입장권 18:30 예약"
            meta="관광 · 예약 18:30"
            time="18:30"
            dense={dense}
            last
          />
        </RouteLine>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-body-2 font-semibold text-fg-sub">다음 역 카드</h3>
        <NextStopCard
          label="다음 일정"
          kicker="다음 역 · 지하철 24분"
          title="센소지"
          countdown="38분"
          countdownSuffix="뒤 14:00"
          progress={0.62}
          progressLabel="하마리큐 정원에서 센소지까지 진행"
          from="하마리큐 정원"
          to="센소지"
          actions={
            <>
              <button
                type="button"
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-btn bg-on-primary text-body-2 font-medium text-primary"
              >
                <Navigation aria-hidden="true" className="size-4" />
                길찾기
              </button>
              <button
                type="button"
                className="flex h-11 flex-1 items-center justify-center rounded-btn bg-on-primary/20 text-body-2 font-medium"
              >
                일정 보기
              </button>
            </>
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-body-2 font-semibold text-fg-sub">탑승권 · 안내표</h3>
        <TicketCard
          header="대한항공 KE703 · 11.24 (화)"
          from={{ code: 'ICN', sub: '09:05 · T2' }}
          to={{ code: 'NRT', sub: '11:30 · T1' }}
          cells={[
            {
              label: '예약번호',
              value: 'Q7XK2M',
              accent: true,
              onClick: copy,
              'aria-label': '예약번호 Q7XK2M 복사',
            },
            { label: '좌석', value: '32A' },
            { label: '수하물', value: '23kg' },
          ]}
          footer="회원번호 KE 1234 5678 · 모닝캄"
        />
        <TicketCard
          header="신칸센 노조미 23호 · 11.26 (목)"
          from={{ code: '도쿄', sub: '08:30' }}
          to={{ code: '신오사카', sub: '10:57' }}
          via={<TrainFront />}
          codeSize="name"
          cells={[
            { label: '예약번호', value: 'E4-2291', accent: true, onClick: copy },
            { label: '호차·좌석', value: '7호차 12D' },
            { label: '승강장', value: '19' },
          ]}
        />
        <TicketCard
          header="숙소 · 3박 · 2명"
          title="호텔 그레이스리 신주쿠"
          cells={[
            { label: '체크인', value: '11.24 15:00' },
            { label: '체크아웃', value: '11.27 11:00' },
            { label: '예약번호', value: 'AG-88213', accent: true, onClick: copy },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-body-2 font-semibold text-fg-sub">출발 게이트</h3>
        <GateProgress
          title="출발 게이트"
          done={12}
          total={18}
          note="필수 2개 남았어요"
          tone="warn"
        />
        <GateProgress title="출발 게이트" done={18} total={18} note="모두 준비됐어요" tone="ok" />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-body-2 font-semibold text-fg-sub">여권 도장</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Tokyo', '2026.11', 0, 'trip-tokyo'],
            ['Busan', '2026.09', 1, 'trip-busan'],
            ['Taipei', '2026.05', 2, 'trip-taipei'],
            ['Osaka', '2025.12', 3, 'trip-osaka'],
            ['Jeju', '2025.08', 4, 'trip-jeju'],
            ['Da Nang', '2025.03', 5, 'trip-danang'],
          ].map(([city, period, i, seed]) => (
            <Stamp
              key={seed as string}
              city={city as string}
              period={period as string}
              dayIndex={i as number}
              seed={seed as string}
              label={`${city} ${period}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
