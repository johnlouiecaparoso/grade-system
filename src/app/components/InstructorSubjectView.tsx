import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { User, LogOut, ArrowLeft, Edit, Plus, Trash2, Link as LinkIcon, Copy } from 'lucide-react';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  calculateTotalGradePercent,
  CO_ASSESSMENT_TASKS,
  createEmptyAssessmentScores,
  finalWeightPercent,
  formatGradePoint5,
} from '../../lib/grades';
import { UserAvatar } from './UserAvatar';

interface InstructorSubjectViewProps {
  onLogout: () => void;
}

interface StudentGrade {
  gradeId: string;
  studentName: string;
  studentNumber: string;
  totalGrade: number;
  assessmentScores: Record<string, number>;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
}

interface Section {
  id: string;
  year: string;
  section: string;
}

function toInputScoreMap(scores: Record<string, number>): Record<string, string> {
  return CO_ASSESSMENT_TASKS.reduce<Record<string, string>>((acc, task) => {
    const score = Number(scores[task.taskKey] ?? 0);
    acc[task.taskKey] = score === 0 ? '' : String(score);
    return acc;
  }, {});
}

function toNumericScoreMap(scores: Record<string, string>): Record<string, number> {
  return CO_ASSESSMENT_TASKS.reduce<Record<string, number>>((acc, task) => {
    const parsed = parseFloat(scores[task.taskKey]);
    acc[task.taskKey] = Number.isFinite(parsed) ? parsed : 0;
    return acc;
  }, {});
}

function createEmptyInputScoreMap(): Record<string, string> {
  return CO_ASSESSMENT_TASKS.reduce<Record<string, string>>((acc, task) => {
    acc[task.taskKey] = '';
    return acc;
  }, {});
}

export default function InstructorSubjectView({ onLogout }: InstructorSubjectViewProps) {
  const navigate = useNavigate();
  const { sectionId, subjectId } = useParams();
  const { user, profile } = useAuth();
  const [section, setSection] = useState<Section | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [subjectTotalScores, setSubjectTotalScores] = useState<Record<string, number>>(createEmptyAssessmentScores());
  const [students, setStudents] = useState<StudentGrade[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentGrade | null>(null);
  const [editScores, setEditScores] = useState<Record<string, string>>(toInputScoreMap(createEmptyAssessmentScores()));
  const [editTotalScores, setEditTotalScores] = useState<Record<string, string>>(createEmptyInputScoreMap());
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [removeStudentOpen, setRemoveStudentOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<StudentGrade | null>(null);
  const [addStudentNumber, setAddStudentNumber] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');

  useEffect(() => {
    if (!sectionId || !subjectId) return;

    (async () => {
      const { data: sectionData, error: sectionError } = await supabase
        .from('sections')
        .select('*')
        .eq('id', sectionId)
        .single();

      if (!sectionError && sectionData) {
        setSection({
          id: sectionData.id,
          year: sectionData.year,
          section: sectionData.section,
        });
      }

      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .single();

      if (!subjectError && subjectData) {
        setSubject({
          id: subjectData.id,
          name: subjectData.name,
          code: subjectData.code,
          credits: subjectData.credits ?? 0,
        });
      }

      const { data: totalScoreRows, error: totalScoreError } = await supabase
        .from('subject_assessment_total_scores')
        .select('task_key, total_score')
        .eq('subject_id', subjectId);

      if (!totalScoreError) {
        const totalScores = createEmptyAssessmentScores();
        for (const row of totalScoreRows || []) {
          const record = row as { task_key: string; total_score: number };
          totalScores[record.task_key] = Number(record.total_score ?? 0);
        }
        setSubjectTotalScores(totalScores);
      }

      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('id, student_name, student_number, total_grade')
        .eq('subject_id', subjectId)
        .order('student_number');

      if (gradesError) {
        setStudents([]);
        return;
      }

      const baseList = (gradesData || []).map((grade: {
        id: string;
        student_name: string;
        student_number: string;
        total_grade: number;
      }) => ({
        gradeId: grade.id,
        studentName: grade.student_name,
        studentNumber: grade.student_number,
        totalGrade: Number(grade.total_grade),
        assessmentScores: createEmptyAssessmentScores(),
      }));

      if (baseList.length === 0) {
        setStudents([]);
        return;
      }

      const gradeIds = baseList.map((item) => item.gradeId);
      const { data: scoreRows, error: scoreError } = await supabase
        .from('grade_assessment_scores')
        .select('grade_id, task_key, score')
        .in('grade_id', gradeIds);

      if (scoreError) {
        setStudents(baseList);
        return;
      }

      const scoreByGrade = baseList.reduce<Record<string, Record<string, number>>>((acc, student) => {
        acc[student.gradeId] = createEmptyAssessmentScores();
        return acc;
      }, {});

      for (const row of scoreRows || []) {
        const record = row as { grade_id: string; task_key: string; score: number };
        if (scoreByGrade[record.grade_id]) {
          scoreByGrade[record.grade_id][record.task_key] = Number(record.score ?? 0);
        }
      }

      const mapped = baseList.map((student) => {
        const assessmentScores = scoreByGrade[student.gradeId] ?? createEmptyAssessmentScores();
        const hasAnyScore = CO_ASSESSMENT_TASKS.some((task) => assessmentScores[task.taskKey] > 0);

        return {
          ...student,
          assessmentScores,
          totalGrade: hasAnyScore ? calculateTotalGradePercent(assessmentScores, subjectTotalScores) : student.totalGrade,
        };
      });

      setStudents(mapped);
    })();
  }, [sectionId, subjectId]);

  const computedEditTotal = useMemo(() => {
    return calculateTotalGradePercent(toNumericScoreMap(editScores), toNumericScoreMap(editTotalScores));
  }, [editScores, editTotalScores]);

  const inviteLink = useMemo(() => {
    if (!inviteToken) return '';
    return `${window.location.origin}/join/${inviteToken}`;
  }, [inviteToken]);

  const inviteQrUrl = useMemo(() => {
    if (!inviteLink) return '';
    return `https://quickchart.io/qr?size=240&text=${encodeURIComponent(inviteLink)}`;
  }, [inviteLink]);

  const createNewInvite = useCallback(async () => {
    if (!subjectId || !user?.id) return null;

    const token = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('subject_invites')
      .update({ is_active: false })
      .eq('subject_id', subjectId)
      .eq('is_active', true);

    const { data: newInvite, error: createError } = await supabase
      .from('subject_invites')
      .insert({
        subject_id: subjectId,
        token,
        created_by: user.id,
        expires_at: expiresAt,
        is_active: true,
      })
      .select('token, expires_at')
      .single();

    if (createError) {
      throw createError;
    }

    return newInvite;
  }, [subjectId, user?.id]);

  const syncInvite = useCallback(async (forceNew = false) => {
    if (!subjectId || !user?.id) return;

    setInviteLoading(true);

    try {
      if (!forceNew) {
        const nowIso = new Date().toISOString();
        const { data: existingInvite, error: existingError } = await supabase
          .from('subject_invites')
          .select('token, expires_at')
          .eq('subject_id', subjectId)
          .eq('is_active', true)
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (existingInvite) {
          setInviteToken(existingInvite.token);
          setInviteExpiresAt(existingInvite.expires_at);
          setInviteLoading(false);
          return;
        }
      }

      const freshInvite = await createNewInvite();
      if (freshInvite) {
        setInviteToken(freshInvite.token);
        setInviteExpiresAt(freshInvite.expires_at);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not prepare invite link';
      toast.error(message);
    } finally {
      setInviteLoading(false);
    }
  }, [createNewInvite, subjectId, user?.id]);

  const handleEditClick = (student: StudentGrade) => {
    setSelectedStudent(student);
    setEditScores(toInputScoreMap(student.assessmentScores));
    setEditTotalScores(toInputScoreMap(subjectTotalScores));
    setIsEditDialogOpen(true);
  };

  const handleSaveGrades = async () => {
    if (!selectedStudent || !subjectId) return;

    const numericScores = toNumericScoreMap(editScores);
    const numericTotalScores = toNumericScoreMap(editTotalScores);

    const totalGrade = calculateTotalGradePercent(numericScores, numericTotalScores);
    const scorePayload = CO_ASSESSMENT_TASKS.map((task) => ({
      grade_id: selectedStudent.gradeId,
      task_key: task.taskKey,
      score: numericScores[task.taskKey],
    }));

    const totalScorePayload = CO_ASSESSMENT_TASKS.map((task) => ({
      subject_id: subjectId,
      task_key: task.taskKey,
      total_score: numericTotalScores[task.taskKey],
    }));

    const { error: totalScoreError } = await supabase
      .from('subject_assessment_total_scores')
      .upsert(totalScorePayload, { onConflict: 'subject_id,task_key' });

    if (totalScoreError) {
      toast.error(totalScoreError.message);
      return;
    }

    const { error: scoreError } = await supabase
      .from('grade_assessment_scores')
      .upsert(scorePayload, { onConflict: 'grade_id,task_key' });

    if (scoreError) {
      toast.error(scoreError.message);
      return;
    }

    const { error: gradeError } = await supabase
      .from('grades')
      .update({ total_grade: totalGrade })
      .eq('id', selectedStudent.gradeId);

    if (gradeError) {
      toast.error(gradeError.message);
      return;
    }

    setStudents((prev) =>
      prev.map((student) =>
        student.gradeId === selectedStudent.gradeId
          ? { ...student, assessmentScores: numericScores, totalGrade }
          : student
      )
    );
    setSubjectTotalScores(numericTotalScores);

    setIsEditDialogOpen(false);
    setSelectedStudent(null);
    toast.success('Student grades and subject total scores updated successfully');
  };

  const handleAddStudent = async () => {
    if (!subjectId) return;

    const studentNumber = addStudentNumber.trim();
    if (!studentNumber) {
      toast.error('Student ID number is required');
      return;
    }

    const { data: profileData, error: lookupError } = await supabase
      .from('profiles')
      .select('id, full_name, student_number')
      .eq('role', 'student')
      .eq('student_number', studentNumber)
      .maybeSingle();

    if (lookupError) {
      toast.error('Could not look up student: ' + lookupError.message);
      return;
    }

    if (!profileData) {
      toast.error('No student found with that ID number. The student must be registered first.');
      return;
    }

    const { data: insertedGrade, error: gradeInsertError } = await supabase
      .from('grades')
      .insert({
        subject_id: subjectId,
        student_profile_id: profileData.id,
        student_name: profileData.full_name,
        student_number: profileData.student_number,
        total_grade: 0,
      })
      .select('id, student_name, student_number, total_grade')
      .single();

    if (gradeInsertError) {
      if (gradeInsertError.code === '23505') {
        toast.error('This student is already in this subject.');
      } else {
        toast.error(gradeInsertError.message);
      }
      return;
    }

    const initialScores = createEmptyAssessmentScores();
    const scorePayload = CO_ASSESSMENT_TASKS.map((task) => ({
      grade_id: insertedGrade.id,
      task_key: task.taskKey,
      score: initialScores[task.taskKey],
    }));

    const { error: scoreInsertError } = await supabase
      .from('grade_assessment_scores')
      .insert(scorePayload);

    if (scoreInsertError) {
      toast.error(scoreInsertError.message);
      await supabase.from('grades').delete().eq('id', insertedGrade.id);
      return;
    }

    setStudents((prev) => [
      ...prev,
      {
        gradeId: insertedGrade.id,
        studentName: insertedGrade.student_name,
        studentNumber: insertedGrade.student_number,
        totalGrade: Number(insertedGrade.total_grade),
        assessmentScores: initialScores,
      },
    ]);

    setAddStudentNumber('');
    setAddStudentOpen(false);
    toast.success('Student added');
  };

  const openInviteDialog = async () => {
    setInviteDialogOpen(true);
    await syncInvite(false);
  };

  useEffect(() => {
    if (!inviteDialogOpen || !inviteExpiresAt) return;

    const msUntilExpiry = new Date(inviteExpiresAt).getTime() - Date.now();

    if (msUntilExpiry <= 0) {
      void syncInvite(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncInvite(true);
    }, msUntilExpiry + 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [inviteDialogOpen, inviteExpiresAt, syncInvite]);

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy invite link');
    }
  };

  const openRemoveStudent = (student: StudentGrade) => {
    setStudentToRemove(student);
    setRemoveStudentOpen(true);
  };

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;

    const { error } = await supabase
      .from('grades')
      .delete()
      .eq('id', studentToRemove.gradeId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setStudents((prev) => prev.filter((student) => student.gradeId !== studentToRemove.gradeId));
    setRemoveStudentOpen(false);
    setStudentToRemove(null);
    toast.success('Student removed');
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const calculateClassAverage = () => {
    if (students.length === 0) return 0;
    const total = students.reduce((sum, student) => sum + student.totalGrade, 0);
    return (total / students.length).toFixed(1);
  };

  if (!section || !subject) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <img src="/logo.png" alt="Logo" className="h-10 w-10 rounded-lg" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Grade Portal</h1>
                <p className="text-sm text-gray-500">Instructor Dashboard</p>
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
        <Button variant="ghost" onClick={() => navigate(`/section/${sectionId}`)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Subjects
        </Button>

        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
            <div className="min-w-0">
              <h2 className="text-3xl font-semibold text-gray-900 mb-2">{subject.name}</h2>
              <p className="text-gray-600">{subject.code} • {section.year} - {section.section}</p>
              <p className="text-sm text-gray-500 mt-1">{subject.credits} Credit Hours</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Class Average</div>
              <div className="text-3xl font-semibold text-[#48A111]">{calculateClassAverage()}%</div>
            </div>
          </div>
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <div>Total Students: <span className="font-medium text-gray-900">{students.length}</span></div>
            <div>Grading: <span className="font-medium text-gray-900">CO-based Assessment Tasks (Final Wt = CO Wt × AT Wt)</span></div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Student Grades</CardTitle>
                <CardDescription>Manage student grades per CO and assessment task.</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={openInviteDialog} className="shrink-0">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Share Invite
                </Button>
                <Button onClick={() => setAddStudentOpen(true)} className="bg-[#48A111] hover:bg-[#3d8f0e] shrink-0">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Final Grade (%)</TableHead>
                    <TableHead className="text-center">Grade Number</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.gradeId}>
                      <TableCell className="font-medium">{student.studentNumber}</TableCell>
                      <TableCell>{student.studentName}</TableCell>
                      <TableCell className="text-center font-semibold">{student.totalGrade}%</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-[#e8f5e0] text-[#2d6b0a] hover:bg-[#e8f5e0]">
                          {formatGradePoint5(student.totalGrade)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(student)}
                            title="Edit grades"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => openRemoveStudent(student)}
                            title="Remove student"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Subject Invite Link</DialogTitle>
              <DialogDescription>
                Share this link or QR code so students can join {subject.name}.
              </DialogDescription>
            </DialogHeader>

            {inviteLoading ? (
              <p className="text-sm text-gray-600">Preparing invite link...</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject-invite-link">Join Link</Label>
                  <div className="flex gap-2">
                    <Input id="subject-invite-link" value={inviteLink} readOnly />
                    <Button type="button" variant="outline" onClick={handleCopyInviteLink}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {inviteQrUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={inviteQrUrl} alt="Subject invite QR code" className="h-56 w-56 rounded-md border p-2" />
                    <p className="text-xs text-gray-500 text-center">Students can scan this QR to open the join link.</p>
                  </div>
                ) : null}

                {inviteExpiresAt ? (
                  <p className="text-xs text-gray-500">Expires on {new Date(inviteExpiresAt).toLocaleString()}</p>
                ) : null}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw]">
            <DialogHeader>
              <DialogTitle>Edit Student Grades</DialogTitle>
              <DialogDescription>
                Assign scores by CO and Assessment Task for {selectedStudent?.studentName} ({selectedStudent?.studentNumber}).
                Total Score is saved per subject task, stays editable, and is shared across all enrolled students.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-x-auto max-h-[60vh] border rounded-md">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>CO</TableHead>
                    <TableHead>CO Wt (%)</TableHead>
                    <TableHead>Assessment Task</TableHead>
                    <TableHead>AT Wt (%)</TableHead>
                    <TableHead>Final Wt (%)</TableHead>
                    <TableHead>Total Score</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CO_ASSESSMENT_TASKS.map((task) => {
                    const finalWeight = finalWeightPercent(task);

                    return (
                      <TableRow key={task.taskKey}>
                        <TableCell>{task.co}</TableCell>
                        <TableCell>{task.coWeight.toFixed(2)}%</TableCell>
                        <TableCell>{task.assessmentTask}</TableCell>
                        <TableCell>{task.atWeight.toFixed(2)}%</TableCell>
                        <TableCell>{finalWeight.toFixed(2)}%</TableCell>
                        <TableCell className="w-[150px]">
                          <Input
                            type="number"
                            step="any"
                            value={editTotalScores[task.taskKey] ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setEditTotalScores((prev) => ({ ...prev, [task.taskKey]: value }));
                            }}
                            placeholder="Enter total score"
                          />
                        </TableCell>
                        <TableCell className="w-[150px]">
                          <Input
                            type="number"
                            step="any"
                            value={editScores[task.taskKey] ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setEditScores((prev) => ({ ...prev, [task.taskKey]: value }));
                            }}
                            placeholder="Enter score"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-[#e8f5e0]">
              <span className="font-semibold text-gray-900">Computed Final Grade</span>
              <span className="font-semibold text-[#48A111] text-lg">
                {computedEditTotal}% ({formatGradePoint5(computedEditTotal)})
              </span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveGrades} className="bg-[#48A111] hover:bg-[#3d8f0e]">
                Save Grades
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Student</DialogTitle>
              <DialogDescription>
                Enter the student&apos;s ID number. Assessment task records will be auto-created with initial score 0.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-student-number">Student ID number (required)</Label>
                <Input
                  id="add-student-number"
                  value={addStudentNumber}
                  onChange={(event) => setAddStudentNumber(event.target.value)}
                  placeholder="e.g. STU001 (must match a registered student)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddStudentOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddStudent} className="bg-[#48A111] hover:bg-[#3d8f0e]">
                Add Student
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={removeStudentOpen} onOpenChange={setRemoveStudentOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove student?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove &quot;{studentToRemove?.studentName}&quot; ({studentToRemove?.studentNumber}) from this subject.
                Their grade record and assessment task scores will be deleted. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveStudent} className="bg-red-600 hover:bg-red-700">
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
