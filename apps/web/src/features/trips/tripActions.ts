import type { Trip } from '@trippocket/shared';
import { tripRepo } from '../../data/repositories/tripRepo';
import i18n from '../../i18n';
import { confirmDelete, snackbar } from '../../shared/ui';

/** 여행 삭제 (한 번 더 묻고) + 실행 취소 스낵바 (목록·메뉴·설정에서 같은 동작). 지웠으면 true */
export async function deleteTripWithUndo(trip: Trip): Promise<boolean> {
  if (!(await confirmDelete(i18n.t('confirm.trip', { name: trip.title })))) return false;
  await tripRepo.softDelete(trip.id);
  snackbar(i18n.t('trips.deleted'), {
    label: i18n.t('common.undo'),
    onAction: () => void tripRepo.restore(trip.id),
  });
  return true;
}
