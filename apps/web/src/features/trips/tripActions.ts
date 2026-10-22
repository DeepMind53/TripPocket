import type { Trip } from '@trippocket/shared';
import { tripRepo } from '../../data/repositories/tripRepo';
import i18n from '../../i18n';
import { snackbar } from '../../shared/ui';

/** 여행 삭제 + 실행 취소 스낵바 (목록·메뉴·설정에서 같은 동작) */
export async function deleteTripWithUndo(trip: Trip): Promise<void> {
  await tripRepo.softDelete(trip.id);
  snackbar(i18n.t('trips.deleted'), {
    label: i18n.t('common.undo'),
    onAction: () => void tripRepo.restore(trip.id),
  });
}
