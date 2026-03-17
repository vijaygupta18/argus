import { useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import IssueDetail from '../components/IssueDetail';

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Issue not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <IssueDetail issueId={id} />
    </div>
  );
}
