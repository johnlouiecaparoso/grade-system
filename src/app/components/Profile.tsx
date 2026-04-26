import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { UserAvatar } from './UserAvatar';
import { User, LogOut, Mail, Save, ArrowLeft, BookOpen, TrendingUp, Camera, Award } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseUrl } from '../../lib/supabase';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

interface ProfileProps {
  onLogout: () => void;
}

export default function Profile({ onLogout }: ProfileProps) {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    studentId: ''
  });
  const [subjectsCount, setSubjectsCount] = useState(0);
  const [gpa, setGpa] = useState('0');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileImgError, setProfileImgError] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.full_name,
        email: profile.email,
        studentId: profile.student_number || ''
      });
    }
  }, [profile]);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    const orFilter = user.studentId
      ? `student_profile_id.eq.${user.id},student_number.eq.${user.studentId}`
      : `student_profile_id.eq.${user.id}`;
    const { data } = await supabase
      .from('grades')
      .select('total_grade, subjects(credits)')
      .or(orFilter);
    const list = (data || []).filter((g: { subjects?: { credits: number } }) => g.subjects);
    setSubjectsCount(list.length);
    if (list.length === 0) {
      setGpa('0');
      return;
    }
    const totalPoints = list.reduce((sum: number, g: { total_grade: number; subjects: { credits: number } }) => {
      const gradePoint = g.total_grade >= 90 ? 4.0 : g.total_grade >= 85 ? 3.7 : g.total_grade >= 80 ? 3.3 : g.total_grade >= 75 ? 3.0 : g.total_grade >= 70 ? 2.7 : 2.0;
      return sum + gradePoint * (g.subjects?.credits ?? 0);
    }, 0);
    const totalCreds = list.reduce((sum: number, g: { subjects: { credits: number } }) => sum + (g.subjects?.credits ?? 0), 0);
    setGpa((totalPoints / totalCreds).toFixed(2));
  }, [user?.id, user?.studentId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSave = async () => {
    if (!user?.id) return;
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: formData.name,
        student_number: formData.studentId || null,
      })
      .eq('id', user.id);
    if (profileError) {
      toast.error(profileError.message);
      return;
    }
    if (formData.email !== profile?.email) {
      const { error: authError } = await supabase.auth.updateUser({ email: formData.email });
      if (authError) {
        toast.error('Profile updated but email change failed: ' + authError.message);
      }
    }
    await refreshProfile();
    setIsEditing(false);
    toast.success('Profile updated successfully!');
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG, etc.)');
      return;
    }
    setUploadingAvatar(true);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      toast.error('Session expired. Please log out and log in again, then try uploading.');
      setUploadingAvatar(false);
      return;
    }
    await supabase.auth.refreshSession();
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    const token = freshSession?.access_token ?? session.access_token;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    // Upload with explicit Authorization header so the request is always authenticated
    const uploadUrl = `${supabaseUrl}/storage/v1/object/avatars/${path}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
        'Content-Type': file.type || 'image/jpeg',
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      let errMsg = uploadRes.status === 400 ? (errText || 'Upload failed (check that the avatars bucket exists and is public)') : errText;
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.message) errMsg = errJson.message;
      } catch {
        // use errMsg as is
      }
      toast.error('Upload failed: ' + errMsg);
      setUploadingAvatar(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', user.id);
    if (profileError) {
      toast.error('Profile update failed: ' + profileError.message);
      setUploadingAvatar(false);
      return;
    }
    await refreshProfile();
    setUploadingAvatar(false);
    setProfileImgError(false);
    toast.success('Profile picture updated');
    e.target.value = '';
  };

  if (!user || !profile) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100"><p>Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-3 min-w-0">
              <img src="/logo.png" alt="Logo" className="h-10 w-10 rounded-lg" />
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate">Grade Portal</h1>
                <p className="text-xs sm:text-sm text-gray-500">Academic Year 2025-2026</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <UserAvatar avatarUrl={profile?.avatar_url} name={user.name} className="h-9 w-9 shrink-0" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Manage your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    {profile?.avatar_url && !profileImgError && (
                      <AvatarImage src={profile.avatar_url} alt={user.name} onError={() => setProfileImgError(true)} />
                    )}
                    <AvatarFallback className="bg-[#48A111] text-white text-2xl">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute bottom-0 right-0 bg-[#48A111] text-white rounded-full p-1.5 cursor-pointer hover:bg-[#3d8f0e] shadow">
                    <Camera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploadingAvatar}
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{formData.name || user.name}</h3>
                  <p className="text-sm text-gray-600 capitalize">{user.role}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!isEditing}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={!isEditing}
                      className="pl-9"
                    />
                  </div>
                </div>

                {user.role === 'student' && (
                  <div className="space-y-2">
                    <Label htmlFor="studentId">Student ID</Label>
                    <Input
                      id="studentId"
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                {!isEditing ? (
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="bg-[#48A111] hover:bg-[#3d8f0e]"
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleSave}
                      className="bg-[#48A111] hover:bg-[#3d8f0e]"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          name: profile.full_name,
                          email: profile.email,
                          studentId: profile.student_number || ''
                        });
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Academic Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-[#e8f5e0] p-2 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-[#48A111]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Current GPA</p>
                    <p className="text-xl font-semibold">{gpa}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <BookOpen className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Enrolled Courses</p>
                    <p className="text-xl font-semibold">{subjectsCount}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <Award className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Credits</p>
                    <p className="text-xl font-semibold">—</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#e8f5e0] px-4 py-3 rounded-lg">
                  <p className="text-sm text-gray-600">Role</p>
                  <p className="font-semibold text-[#48A111] capitalize">{user.role}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
