import { existsSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TRANSIT_CARD_PHOTOS, transitCardsFor } from '../../data/transitCards';
import { TransitCardList } from './TransitCardList';

describe('교통카드·승차권 사진', () => {
  it('사진 파일이 앱에 모두 들어 있고 출처·라이선스가 있다', () => {
    expect(TRANSIT_CARD_PHOTOS.length).toBeGreaterThan(10);
    for (const c of TRANSIT_CARD_PHOTOS) {
      expect(existsSync(`public${c.photo!.src}`), c.id).toBe(true);
      expect(
        c.photo!.author &&
          c.photo!.license &&
          c.photo!.page.startsWith('https://commons.wikimedia.org/'),
      ).toBeTruthy();
    }
  });

  it('이름을 누르면 사진·출처·공식 안내가 펼쳐진다', () => {
    render(<TransitCardList country="JP" />);
    fireEvent.click(screen.getByRole('button', { name: /스이카/ }));
    expect(screen.getByRole('img', { name: /스이카/ }).getAttribute('src')).toBe(
      '/transit/suica.jpg',
    );
    expect(screen.getByRole('link', { name: /CC BY-SA 4\.0/ }).getAttribute('href')).toContain(
      'commons.wikimedia.org',
    );
    expect(screen.getByRole('link', { name: /스이카.*공식 안내/ }).getAttribute('href')).toContain(
      'jreast',
    );
  });

  it('사진이 없는 카드는 그린 카드로 보여 준다', () => {
    render(<TransitCardList country="JP" />);
    fireEvent.click(screen.getByRole('button', { name: /파스모/ }));
    expect(screen.getByRole('img', { name: /파스모.*그림/ })).toBeTruthy();
    expect(screen.getByText(/그림으로 보여요/)).toBeTruthy();
  });

  it('카드가 없는 나라는 아무것도 그리지 않는다', () => {
    expect(transitCardsFor('KR')).toEqual([]);
    const { container } = render(<TransitCardList country="KR" />);
    expect(container.innerHTML).toBe('');
  });
});
