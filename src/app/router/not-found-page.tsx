import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
export function NotFoundPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Page not found"
        description="The page you requested could not be found."
      />
      <Button asChild>
        <Link to="/dashboard">Return to Dashboard</Link>
      </Button>
    </PageContainer>
  );
}
