import { useTranslation } from '../i18n';
import { Link } from 'react-router';
import { EmptyState } from '../shared/ui';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pt-16">
      <EmptyState
        emoji="🧭"
        title={t('notFound.title')}
        description={t('notFound.desc')}
        action={
          <Link
            to="/"
            className="inline-flex h-11 items-center rounded-btn bg-primary px-4 font-semibold text-on-primary"
          >
            {t('common.goHome')}
          </Link>
        }
      />
    </main>
  );
}
