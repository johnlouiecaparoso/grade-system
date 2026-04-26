import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ArrowLeft, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  calculateTotalGradePercent,
  CO_ASSESSMENT_TASKS,
  createEmptyAssessmentScores,
  formatGradePoint5,
} from '../../lib/grades';
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
  totalGrade: number;
  assessmentScores: Record<string, number>;
  assessmentTotalScores: Record<string, number>;
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
      const { data: gradeData, error: gradeError } = await supabase
        .from('grades')
        .select('id, total_grade, subjects(id, name, code, credits)')
        .eq('subject_id', subjectId)
        .or(orFilter)
        .maybeSingle();

      if (gradeError || !gradeData || !(gradeData as { subjects?: unknown }).subjects) {
        setSubject(null);
        return;
      }

      const grade = gradeData as {
        id: string;
        total_grade: number;
        subjects: { id: string; name: string; code: string; credits: number }[] | { id: string; name: string; code: string; credits: number };
      };

      const subjectRecord = Array.isArray(grade.subjects) ? grade.subjects[0] : grade.subjects;
      if (!subjectRecord) {
        setSubject(null);
        return;
      }

      const { data: scoreRows } = await supabase
        .from('grade_assessment_scores')
        .select('task_key, score')
        .eq('grade_id', grade.id);

      const { data: totalScoreRows } = await supabase
        .from('subject_assessment_total_scores')
        .select('task_key, total_score')
        .eq('subject_id', subjectId);

      const assessmentScores = createEmptyAssessmentScores();
      for (const row of scoreRows || []) {
        const record = row as { task_key: string; score: number };
        assessmentScores[record.task_key] = Number(record.score ?? 0);
      }

      const assessmentTotalScores = createEmptyAssessmentScores();
      for (const row of totalScoreRows || []) {
        const record = row as { task_key: string; total_score: number };
        assessmentTotalScores[record.task_key] = Number(record.total_score ?? 0);
      }

      const hasAnyScore = CO_ASSESSMENT_TASKS.some((task) => assessmentScores[task.taskKey] > 0);

      setSubject({
        id: subjectRecord.id,
        name: subjectRecord.name,
        code: subjectRecord.code,
        instructor: 'Instructor',
        credits: subjectRecord.credits ?? 0,
        totalGrade: hasAnyScore ? calculateTotalGradePercent(assessmentScores, assessmentTotalScores) : Number(grade.total_grade),
        assessmentScores,
        assessmentTotalScores,
      });
    })();
  }, [subjectId, user?.id, user?.studentId]);

  const assessmentRows = useMemo(() => {
    if (!subject) return [];

    return CO_ASSESSMENT_TASKS.map((task) => {
      const score = Number(subject.assessmentScores[task.taskKey] ?? 0);

      return {
        task,
        score,
        totalScore: Number(subject.assessmentTotalScores[task.taskKey] ?? 0),
      };
    });
  }, [subject]);

  if (!subject) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100"><p>Loading...</p></div>;
  }

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="Logo" className="h-10 w-10 rounded-lg" />
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
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

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
              <p className="text-gray-600">Final Grade Scale</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Final Grade Scale</span>
              <span className="font-medium">{formatGradePoint5(subject.totalGrade)}</span>
            </div>
            <Progress value={subject.totalGrade} className="h-3" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>CO and Assessment Tasks</CardTitle>
            <CardDescription>
              Your assessment task scores for this subject
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[430px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[132px]">Assessment Task</TableHead>
                    <TableHead className="w-[80px] whitespace-nowrap">Total Score</TableHead>
                    <TableHead className="w-[72px] whitespace-nowrap">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessmentRows.map((row) => (
                    <TableRow key={row.task.taskKey}>
                      <TableCell className="w-[132px] leading-tight">{row.task.assessmentTask}</TableCell>
                      <TableCell className="w-[80px]">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">{row.totalScore.toFixed(2)}</Badge>
                      </TableCell>
                      <TableCell className="w-[72px]">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">{row.score.toFixed(2)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center py-3 bg-[#e8f5e0] px-4 rounded-lg mt-6">
              <span className="font-semibold text-gray-900">Final Grade</span>
              <span className="font-semibold text-[#48A111] text-lg">
                {formatGradePoint5(subject.totalGrade)}
              </span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
