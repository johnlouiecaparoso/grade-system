import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { ArrowLeft, GraduationCap, User, LogOut, FileText, ClipboardCheck, BookOpen, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatGradePoint5 } from '../../lib/grades';
import { UserAvatar } from './UserAvatar';

interface SubjectDetailProps {
  onLogout: () => void;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  instructor: string;
  credits: number;
  quizzes: number;
  summative: number;
  midterm: number;
  final: number;
  totalGrade: number;
}

export default function SubjectDetail({ onLogout }: SubjectDetailProps) {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const { user, profile } = useAuth();
  const [subject, setSubject] = useState<Subject | null>(null);

  useEffect(() => {
    if (!subjectId || !user?.id) return;
    const orFilter = user.studentId
      ? `student_profile_id.eq.${user.id},student_number.eq.${user.studentId}`
      : `student_profile_id.eq.${user.id}`;
    (async () => {
      const { data, error } = await supabase
        .from('grades')
        .select('quizzes, summative, midterm, final, total_grade, subjects(id, name, code, credits)')
        .eq('subject_id', subjectId)
        .or(orFilter)
        .maybeSingle();
      if (error || !data || !(data as { subjects?: unknown }).subjects) {
        setSubject(null);
        return;
      }
      const g = data as {
        quizzes: number;
        summative: number;
        midterm: number;
        final: number;
        total_grade: number;
        subjects: { id: string; name: string; code: string; credits: number };
      };
      setSubject({
        id: g.subjects.id,
        name: g.subjects.name,
        code: g.subjects.code,
        instructor: 'Instructor',
        credits: g.subjects.credits ?? 0,
        quizzes: Number(g.quizzes),
        summative: Number(g.summative),
        midterm: Number(g.midterm),
        final: Number(g.final),
        totalGrade: Number(g.total_grade),
      });
    })();
  }, [subjectId, user?.id, user?.studentId]);

  if (!subject) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100"><p>Loading...</p></div>;
  }

  const assessments = [
    {
      name: 'Quizzes',
      score: subject.quizzes,
      weight: '20%',
      icon: FileText,
      color: 'bg-blue-500'
    },
    {
      name: 'Summative Tests',
      score: subject.summative,
      weight: '30%',
      icon: ClipboardCheck,
      color: 'bg-green-500'
    },
    {
      name: 'Midterm Exam',
      score: subject.midterm,
      weight: '50%',
      icon: BookOpen,
      color: 'bg-orange-500'
    },
    {
      name: 'Final Exam',
      score: subject.final,
      weight: '0%',
      icon: Trophy,
      color: 'bg-purple-500'
    }
  ];

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-3">
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Subject Header */}
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900 mb-2 break-words">{subject.name}</h2>
              <p className="text-gray-600 text-sm sm:text-base">{subject.code} • {subject.instructor}</p>
              <p className="text-sm text-gray-500 mt-1">{subject.credits} Credit Hours</p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <div className="text-3xl sm:text-4xl font-semibold text-[#48A111] mb-1">
                {formatGradePoint5(subject.totalGrade)}
              </div>
              <p className="text-gray-600">{subject.totalGrade}%</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Overall Progress</span>
              <span className="font-medium">{subject.totalGrade}%</span>
            </div>
            <Progress value={subject.totalGrade} className="h-3" />
          </div>
        </div>

        {/* Grade Breakdown */}
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Grade Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assessments.map((assessment) => {
            const IconComponent = assessment.icon;
            return (
              <Card key={assessment.name}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`${assessment.color} p-2 rounded-lg`}>
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{assessment.name}</CardTitle>
                        <CardDescription>Weight: {assessment.weight}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {assessment.score}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={assessment.score} className="h-2" />
                  <p className="text-xs text-gray-600 mt-2">
                    Grade: {formatGradePoint5(assessment.score)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Performance Summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
            <CardDescription>Detailed analysis of your grades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Quizzes Average</span>
                <span className="font-medium">{subject.quizzes}% (Contributes {(subject.quizzes * 0.2).toFixed(1)} points)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Summative Tests Average</span>
                <span className="font-medium">{subject.summative}% (Contributes {(subject.summative * 0.3).toFixed(1)} points)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Midterm Exam</span>
                <span className="font-medium">{subject.midterm}% (Contributes {(subject.midterm * 0.5).toFixed(1)} points)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Final Exam</span>
                <span className="font-medium">{subject.final > 0 ? `${subject.final}%` : 'Not yet taken'}</span>
              </div>
              <div className="flex justify-between items-center py-3 bg-[#e8f5e0] px-4 rounded-lg mt-4">
                <span className="font-semibold text-gray-900">Current Total Grade</span>
                <span className="font-semibold text-[#48A111] text-lg">{subject.totalGrade}% ({formatGradePoint5(subject.totalGrade)})</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
