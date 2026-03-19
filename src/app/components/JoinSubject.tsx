import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { GraduationCap, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { UserAvatar } from './UserAvatar';
import { supabase } from '../../lib/supabase';

interface JoinSubjectProps {
  onLogout: () => void;
}

interface InviteSubject {
  id: string;
  name: string;
  code: string;
}

export default function JoinSubject({ onLogout }: JoinSubjectProps) {
  const navigate = useNavigate();
  const { token } = useParams();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [inviteSubject, setInviteSubject] = useState<InviteSubject | null>(null);

  useEffect(() => {
    if (!token) {
      setInviteError('Invite token is missing.');
      setLoading(false);
      return;
    }

    (async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('subject_invites')
        .select('expires_at, subjects(id, name, code)')
        .eq('token', token)
        .eq('is_active', true)
        .gt('expires_at', nowIso)
        .maybeSingle();

      if (error || !data) {
        setInviteError('This invite link is invalid or expired.');
        setLoading(false);
        return;
      }

      const subjectRow = Array.isArray(data.subjects) ? data.subjects[0] : data.subjects;
      if (!subjectRow) {
        setInviteError('The subject for this invite could not be found.');
        setLoading(false);
        return;
      }

      setInviteSubject({
        id: subjectRow.id,
        name: subjectRow.name,
        code: subjectRow.code,
      });
      setInviteExpiresAt(data.expires_at);
      setLoading(false);
    })();
  }, [token]);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleJoinSubject = async () => {
    if (!token) return;

    setJoining(true);
    const { data, error } = await supabase.rpc('join_subject_with_token', { invite_token: token });

    if (error) {
      toast.error(error.message);
      setJoining(false);
      return;
    }

    const subjectId = String(data ?? inviteSubject?.id ?? '');
    toast.success('You joined the subject successfully.');
    setJoining(false);

    if (subjectId) {
      navigate(`/subject/${subjectId}`);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-3">
              <div className="bg-[#48A111] p-2 rounded-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Grade Portal</h1>
                <p className="text-sm text-gray-500">Student Join Subject</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <UserAvatar avatarUrl={profile?.avatar_url} name={user?.name ?? 'User'} className="h-9 w-9 shrink-0" />
              <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-1.5" />
                Profile
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-3 sm:px-6 lg:px-8 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Join Subject</CardTitle>
            <CardDescription>Confirm this invite to enroll in the subject.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-600">Loading invite details...</p>
            ) : inviteError ? (
              <div className="space-y-4">
                <p className="text-sm text-red-600">{inviteError}</p>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-lg border p-4 bg-gray-50">
                  <p className="text-sm text-gray-500">Subject</p>
                  <p className="text-lg font-semibold text-gray-900">{inviteSubject?.name}</p>
                  <p className="text-sm text-gray-600">{inviteSubject?.code}</p>
                  {inviteExpiresAt ? (
                    <p className="text-xs text-gray-500 mt-2">Invite expires on {new Date(inviteExpiresAt).toLocaleString()}</p>
                  ) : null}
                </div>

                <Badge className="bg-[#e8f5e0] text-[#2d6b0a] hover:bg-[#e8f5e0]">Student enrollment via invite</Badge>

                <div className="flex gap-2">
                  <Button onClick={handleJoinSubject} className="bg-[#48A111] hover:bg-[#3d8f0e]" disabled={joining}>
                    {joining ? 'Joining...' : 'Join Subject'}
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/dashboard')} disabled={joining}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
