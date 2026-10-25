import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      body="The page you’re looking for doesn’t exist or has moved."
      className="py-32"
      action={
        <Button asChild variant="primary">
          <Link to="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
