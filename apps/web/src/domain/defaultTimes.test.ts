import { bookingDefaultTimes, itemDefaultTimes, switchTimes, nextStartAfter } from './defaultTimes';

it('숙소 15:00·11:00, 음식점 12:00, 그 밖은 비움', () => {
  expect(bookingDefaultTimes('lodging')).toEqual({ start: '15:00', end: '11:00' });
  expect(bookingDefaultTimes('restaurant').start).toBe('12:00');
  expect(bookingDefaultTimes('flight')).toEqual({ start: '', end: '' });
  expect(itemDefaultTimes('food').start).toBe('12:00');
  expect(itemDefaultTimes('place').start).toBe('');
});

it('종류를 바꾸면 초기값 그대로인 칸만 바뀐다', () => {
  const lodging = bookingDefaultTimes('lodging');
  const flight = bookingDefaultTimes('flight');
  expect(switchTimes(lodging, flight, lodging)).toEqual(lodging);
  expect(switchTimes(lodging, lodging, flight)).toEqual({ start: '', end: '' });
  expect(switchTimes({ start: '16:00', end: '11:00' }, lodging, flight)).toEqual({
    start: '16:00',
    end: '',
  });
});

describe('nextStartAfter (docs/31 C3)', () => {
  it('그날 일정이 끝난 뒤, 간격에 맞춰 올림', () => {
    expect(
      nextStartAfter([{ startTime: '09:00', endTime: '10:20' }, { startTime: '11:00' }], 30),
    ).toBe('12:00');
    expect(nextStartAfter([{ startTime: '09:00', endTime: '10:20' }], 15)).toBe('10:30');
  });
  it('시각 있는 일정이 없거나 24시를 넘으면 비움', () => {
    expect(nextStartAfter([{}], 10)).toBe('');
    expect(nextStartAfter([{ startTime: '23:30' }], 10)).toBe('');
  });
});
