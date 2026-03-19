import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { GraduationCap, BookOpen, TrendingUp, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatGradePoint5 } from '../../lib/grades';
import { UserAvatar } from './UserAvatar';

interface DashboardProps {
  onLogout: () => void;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  instructor: string;
  credits: number;
  totalGrade: number;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubjects = useCallback(async () => {
    if (!user?.id) return;

    const orFilter = user.studentId
      ? `student_profile_id.eq.${user.id},student_number.eq.${user.studentId}`
      : `student_profile_id.eq.${user.id}`;

    const { data: gradesData, error } = await supabase
      .from('grades')
      .select('id, subject_id, total_grade, subjects(id, name, code, credits)')
      .or(orFilter);

    if (error) {
      setSubjects([]);
      setLoading(false);
      return;
    }

    const list: Subject[] = (gradesData || [])
      .map((grade: {
        total_grade: number;
        subjects: { id: string; name: string; code: string; credits: number }[] | { id: string; name: string; code: string; credits: number } | null;
      }) => {
        const subject = Array.isArray(grade.subjects) ? grade.subjects[0] : grade.subjects;
        if (!subject) return null;

        return {
          id: subject.id,
          name: subject.name,
          code: subject.code,
          instructor: 'Instructor',
          credits: subject.credits ?? 0,
          totalGrade: Number(grade.total_grade),
        };
      })
      .filter((item): item is Subject => item !== null);

    setSubjects(list);
    setLoading(false);
  }, [user?.id, user?.studentId]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const calculateGPA = () => {
    if (subjects.length === 0) return 0;

    const totalPoints = subjects.reduce((sum, subject) => {
      const gradePoint = subject.totalGrade >= 90 ? 4.0
        : subject.totalGrade >= 85 ? 3.7
        : subject.totalGrade >= 80 ? 3.3
        : subject.totalGrade >= 75 ? 3.0
        : subject.totalGrade >= 70 ? 2.7
        : 2.0;

      return sum + (gradePoint * subject.credits);
    }, 0);

    const totalCredits = subjects.reduce((sum, subject) => sum + subject.credits, 0);
    return (totalPoints / totalCredits).toFixed(2);
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className="bg-[#48A111] p-2 rounded-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Grade Portal</h1>
                <p className="text-sm text-gray-500">Academic Year 2025-2026</p>
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

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold text-gray-900 mb-2">Welcome back, {user?.name}!</h2>
          <p className="text-gray-600">Here&apos;s your academic progress overview</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall GPA</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#48A111]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{calculateGPA()}</div>
              <p className="text-xs text-gray-600 mt-1">Out of 4.0</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-[#48A111]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{subjects.length}</div>
              <p className="text-xs text-gray-600 mt-1">This semester</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
              <GraduationCap className="h-4 w-4 text-[#48A111]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{subjects.reduce((sum, subject) => sum + subject.credits, 0)}</div>
              <p className="text-xs text-gray-600 mt-1">Credit hours</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Your Subjects</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subjects.map((subject) => (
            <Card
              key={subject.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/subject/${subject.id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{subject.name}</CardTitle>
                    <CardDescription>{subject.code} • {subject.instructor}</CardDescription>
                  </div>
                  <Badge className="bg-[#e8f5e0] text-[#2d6b0a] hover:bg-[#e8f5e0]">
                    {formatGradePoint5(subject.totalGrade)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Final Grade</span>
                      <span className="font-medium">{subject.totalGrade}%</span>
                    </div>
                    <Progress value={subject.totalGrade} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Grading Basis</p>
                      <p className="font-medium">CO + Assessment Tasks</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Credits</p>
                      <p className="font-medium">{subject.credits}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
