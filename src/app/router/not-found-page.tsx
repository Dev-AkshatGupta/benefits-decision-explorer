import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { useTranslation } from 'react-i18next';
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        title={t('pageNotFound')}
        description={t('requestedPageNotFound')}
      />
      <Button asChild>
        <Link to="/dashboard">{t('returnDashboard')}</Link>
      </Button>
    </PageContainer>
  );
}
