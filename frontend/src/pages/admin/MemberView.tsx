import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../../hooks/useApi';

interface MemberUser {
  id: string;
  fullName: string;
  username: string;
}

export default function MemberView() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberUser | null>(null);

  useEffect(() => {
    if (userId) {
      api.get(`/api/users/${userId}`).then((r) => setMember(r.data)).catch(() => {});
    }
  }, [userId]);

  return (
    <div>
      {/* Yellow impersonation banner */}
      <div className="bg-yellow-400 text-yellow-900 px-6 py-3 flex items-center justify-between mb-6 rounded-lg">
        <span className="font-medium text-sm">
          ⚠ You are viewing as <strong>{member?.fullName || '…'}</strong> (Member View)
        </span>
        <button
          onClick={() => navigate('/admin')}
          className="text-sm font-medium bg-yellow-200 hover:bg-yellow-300 px-3 py-1.5 rounded transition-colors"
        >
          Back to Admin
        </button>
      </div>

      {/* Embed member-facing views here */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500 text-sm">
          Viewing lab system as member: <strong>{member?.fullName}</strong> ({member?.username})
        </p>
        <p className="text-gray-400 text-xs mt-2">
          All actions performed in this view are logged in the audit log as "Admin acting as Member".
        </p>
        {/* For full impersonation, render the member layout/tabs here with the userId context */}
      </div>
    </div>
  );
}
