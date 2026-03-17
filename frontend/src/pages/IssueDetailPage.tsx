import { useParams } from 'react-router-dom';
import IssueDetail from '../components/IssueDetail';

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="p-6 text-center text-slate-500">
        Issue not found
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <IssueDetail issueId={id} />
    </div>
  );
}
