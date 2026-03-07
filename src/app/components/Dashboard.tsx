import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { GraduationCap, BookOpen, TrendingUp, User, LogOut, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
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
  quizzes: number;
  summative: number;
  midterm: number;
  final: number;
  totalGrade: number;
  gradeId?: string; // grades.id for updates
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newGrade, setNewGrade] = useState({
    subjectId: '',
    type: 'quizzes' as 'quizzes' | 'summative' | 'midterm' | 'final',
    score: ''
  });

  const loadSubjects = useCallback(async () => {
    if (!user?.id) return;
    const orFilter = user.studentId
      ? `student_profile_id.eq.${user.id},student_number.eq.${user.studentId}`
      : `student_profile_id.eq.${user.id}`;
    const { data: gradesData, error } = await supabase
      .from('grades')
      .select('id, subject_id, quizzes, summative, midterm, final, total_grade, subjects(id, name, code, credits)')
      .or(orFilter);
    if (error) {
      setSubjects([]);
      setLoading(false);
      return;
    }
    const list: Subject[] = (gradesData || [])
      .filter((g: { subjects: unknown }) => g.subjects)
      .map((g: {
        id: string;
        subject_id: string;
        quizzes: number;
        summative: number;
        midterm: number;
        final: number;
        total_grade: number;
        subjects: { id: string; name: string; code: string; credits: number };
      }) => ({
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
        gradeId: g.id,
      }));
    setSubjects(list);
    setLoading(false);
  }, [user?.id, user?.studentId]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const calculateGPA = () => {
    if (subjects.length === 0) return 0;
    const totalPoints = subjects.reduce((sum, subject) => {
      const gradePoint = subject.totalGrade >= 90 ? 4.0 :
                        subject.totalGrade >= 85 ? 3.7 :
                        subject.totalGrade >= 80 ? 3.3 :
                        subject.totalGrade >= 75 ? 3.0 :
                        subject.totalGrade >= 70 ? 2.7 : 2.0;
      return sum + (gradePoint * subject.credits);
    }, 0);
    const totalCredits = subjects.reduce((sum, subject) => sum + subject.credits, 0);
    return (totalPoints / totalCredits).toFixed(2);
  };


  const handleAddGrade = async () => {
    const target = subjects.find((s) => s.id === newGrade.subjectId);
    if (!newGrade.subjectId || !newGrade.score || !target?.gradeId) {
      toast.error('Please fill in all fields');
      return;
    }

    const score = parseFloat(newGrade.score);
    if (score < 0 || score > 100) {
      toast.error('Score must be between 0 and 100');
      return;
    }

    const updated = { ...target, [newGrade.type]: score };
    updated.totalGrade = Math.round(
      updated.quizzes * 0.2 + updated.summative * 0.3 + updated.midterm * 0.25 + updated.final * 0.25
    );

    const { error } = await supabase
      .from('grades')
      .update({
        [newGrade.type]: score,
        total_grade: updated.totalGrade,
      })
      .eq('id', target.gradeId);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSubjects((prev) =>
      prev.map((s) => (s.id === newGrade.subjectId ? updated : s))
    );
    setIsAddDialogOpen(false);
    setNewGrade({ subjectId: '', type: 'quizzes', score: '' });
    toast.success('Grade updated successfully!');
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
      {/* Header */}
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-semibold text-gray-900 mb-2">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-gray-600">Here's your academic progress overview</p>
        </div>

        {/* Stats Cards */}
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
              <div className="text-2xl font-semibold">
                {subjects.reduce((sum, s) => sum + s.credits, 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">Credit hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Subjects Section */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Your Subjects</h3>
          {user?.role === 'instructor' && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#48A111] hover:bg-[#3d8f0e]">
                  <Plus className="w-4 h-4 mr-2" />
                  Update Grade
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Student Grade</DialogTitle>
                  <DialogDescription>
                    Enter the grade information for a subject
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Select value={newGrade.subjectId} onValueChange={(value) => setNewGrade({ ...newGrade, subjectId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.code} - {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Assessment Type</Label>
                    <Select value={newGrade.type} onValueChange={(value) => setNewGrade({ ...newGrade, type: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quizzes">Quizzes</SelectItem>
                        <SelectItem value="summative">Summative</SelectItem>
                        <SelectItem value="midterm">Midterm</SelectItem>
                        <SelectItem value="final">Final Exam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="score">Score (0-100)</Label>
                    <Input
                      id="score"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="85"
                      value={newGrade.score}
                      onChange={(e) => setNewGrade({ ...newGrade, score: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddGrade} className="bg-[#48A111] hover:bg-[#3d8f0e]">
                    Update Grade
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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
                      <span className="text-gray-600">Overall Progress</span>
                      <span className="font-medium">{subject.totalGrade}%</span>
                    </div>
                    <Progress value={subject.totalGrade} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Quizzes</p>
                      <p className="font-medium">{subject.quizzes}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Summative</p>
                      <p className="font-medium">{subject.summative}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Midterm</p>
                      <p className="font-medium">{subject.midterm}%</p>
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
