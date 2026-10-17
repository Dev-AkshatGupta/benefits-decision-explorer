import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
export function RouteErrorPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-2xl p-8" role="alert">
      <h1 className="text-2xl font-semibold">{t('somethingWentWrong')}</h1>
      <p className="my-6">{t('reloadTryAgain')}</p>
      <Button onClick={() => window.location.assign(import.meta.env.BASE_URL)}>
        {t('returnHome')}
      </Button>
    </main>
  );
}
