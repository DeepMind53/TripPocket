import { bookingDefaultTimes, itemDefaultTimes, switchTimes } from './defaultTimes';

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
