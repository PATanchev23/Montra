import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';
import { useMessages } from '../i18n';
import { common } from '../i18n/common';

export function NotFoundPage() {
  const m = useMessages(common).notFound;
  return (
    <EmptyState
      icon={Compass}
      title={m.title}
      body={m.body}
      className="py-32"
      action={
        <Button asChild variant="primary">
          <Link to="/">{m.back}</Link>
        </Button>
      }
    />
  );
}
