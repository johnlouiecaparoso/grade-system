import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LogOut, ScanLine, User } from 'lucide-react';
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [inviteSubject, setInviteSubject] = useState<InviteSubject | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [scannerSupported, setScannerSupported] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState('');

  useEffect(() => {
    if (!token) {
      setInviteError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setInviteError('');

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

  useEffect(() => {
    setScannerSupported('BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const stopScanner = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setScannerActive(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const extractTokenFromScan = (rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return '';

    const joinMatch = value.match(/\/join\/([a-zA-Z0-9_-]+)/);
    if (joinMatch?.[1]) return joinMatch[1];

    const tokenMatch = value.match(/^[a-zA-Z0-9_-]{16,}$/);
    if (tokenMatch) return value;

    return '';
  };

  const startScanner = async () => {
    if (!scannerSupported) {
      setScannerError('Scanner is not supported on this device/browser.');
      return;
    }

    setScannerError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
      });

      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const BarcodeDetectorCtor = (window as Window & {
        BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> };
      }).BarcodeDetector;

      if (!BarcodeDetectorCtor) {
        setScannerError('Barcode scanner is not available in this browser.');
        stopScanner();
        return;
      }

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      setScannerActive(true);

      const scan = async () => {
        if (!videoRef.current) {
          stopScanner();
          return;
        }

        try {
          const codes = await detector.detect(videoRef.current);
          const rawValue = codes[0]?.rawValue ?? '';
          if (rawValue) {
            const detectedToken = extractTokenFromScan(rawValue);
            if (detectedToken) {
              stopScanner();
              navigate(`/join/${detectedToken}`);
              return;
            }
          }
        } catch {
          // Keep scanner alive on transient frame errors.
        }

        rafRef.current = requestAnimationFrame(() => {
          void scan();
        });
      };

      void scan();
    } catch {
      setScannerError('Could not access camera. Please allow camera permission or enter the token manually.');
      stopScanner();
    }
  };

  const handleManualJoin = () => {
    const parsedToken = extractTokenFromScan(manualToken);
    if (!parsedToken) {
      toast.error('Enter a valid join token or join link.');
      return;
    }

    navigate(`/join/${parsedToken}`);
  };

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
            <div className="flex items-center space-x-3 min-w-0">
              <img src="/logo.png" alt="Logo" className="h-10 w-10 rounded-lg" />
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate">Grade Portal</h1>
                <p className="text-xs sm:text-sm text-gray-500">Student Join Subject</p>
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
            <CardDescription>{token ? 'Confirm this invite to enroll in the subject.' : 'Scan your instructor QR code or paste a join token.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="space-y-5">
                <div className="rounded-lg border p-4 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-700">QR Scanner</p>
                    <Badge className="bg-[#e8f5e0] text-[#2d6b0a] hover:bg-[#e8f5e0]">Student access</Badge>
                  </div>

                  <div className="rounded-md border bg-black/90 overflow-hidden">
                    <video ref={videoRef} className="w-full h-56 object-cover" muted playsInline />
                  </div>

                  {scannerError ? <p className="text-xs text-red-600">{scannerError}</p> : null}

                  <div className="flex flex-col sm:flex-row gap-2">
                    {scannerActive ? (
                      <Button variant="outline" onClick={stopScanner}>
                        Stop Scanner
                      </Button>
                    ) : (
                      <Button onClick={() => void startScanner()} className="bg-[#48A111] hover:bg-[#3d8f0e]" disabled={!scannerSupported}>
                        <ScanLine className="w-4 h-4 mr-2" />
                        Start Scanner
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => navigate('/dashboard')}>
                      Back to Dashboard
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-token">Or enter invite token/link manually</Label>
                  <Input
                    id="manual-token"
                    value={manualToken}
                    onChange={(event) => setManualToken(event.target.value)}
                    placeholder="Paste /join token or full join link"
                  />
                  <Button onClick={handleManualJoin} className="bg-[#48A111] hover:bg-[#3d8f0e]">
                    Continue
                  </Button>
                </div>
              </div>
            ) : loading ? (
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

                <div className="flex flex-col sm:flex-row gap-2">
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
