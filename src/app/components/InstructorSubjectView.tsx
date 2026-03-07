import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
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
import { GraduationCap, User, LogOut, ArrowLeft, Edit, Plus, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatGradePoint5 } from '../../lib/grades';
import { UserAvatar } from './UserAvatar';

interface InstructorSubjectViewProps {
  onLogout: () => void;
}

interface StudentGrade {
  studentId: string;
  studentName: string;
  studentNumber: string;
  quizzes: number;
  summative: number;
  midterm: number;
  final: number;
  totalGrade: number;
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

export default function InstructorSubjectView({ onLogout }: InstructorSubjectViewProps) {
  const navigate = useNavigate();
  const { sectionId, subjectId } = useParams();
  const { user, profile } = useAuth();
  const [section, setSection] = useState<Section | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [students, setStudents] = useState<StudentGrade[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentGrade | null>(null);
  const [editScores, setEditScores] = useState({
    quizzes: '',
    summative: '',
    midterm: '',
    final: ''
  });
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [removeStudentOpen, setRemoveStudentOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<StudentGrade | null>(null);
  const [addStudentForm, setAddStudentForm] = useState({
    studentNumber: '',
    quizzes: '0',
    summative: '0',
    midterm: '0',
    final: '0'
  });

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
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('*')
        .eq('subject_id', subjectId)
        .order('student_number');
      if (gradesError) {
        setStudents([]);
        return;
      }
      const list: StudentGrade[] = (gradesData || []).map((g: {
        id: string;
        student_name: string;
        student_number: string;
        quizzes: number;
        summative: number;
        midterm: number;
        final: number;
        total_grade: number;
      }) => ({
        studentId: g.id,
        studentName: g.student_name,
        studentNumber: g.student_number,
        quizzes: Number(g.quizzes),
        summative: Number(g.summative),
        midterm: Number(g.midterm),
        final: Number(g.final),
        totalGrade: Number(g.total_grade),
      }));
      setStudents(list);
    })();
  }, [sectionId, subjectId]);


  const handleEditClick = (student: StudentGrade) => {
    setSelectedStudent(student);
    setEditScores({
      quizzes: student.quizzes.toString(),
      summative: student.summative.toString(),
      midterm: student.midterm.toString(),
      final: student.final.toString()
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveGrades = async () => {
    if (!selectedStudent || !subjectId) return;

    const quizzes = parseFloat(editScores.quizzes);
    const summative = parseFloat(editScores.summative);
    const midterm = parseFloat(editScores.midterm);
    const final = parseFloat(editScores.final);

    if ([quizzes, summative, midterm, final].some(score => score < 0 || score > 100)) {
      toast.error('Scores must be between 0 and 100');
      return;
    }

    const totalGrade = Math.round(
      quizzes * 0.2 + summative * 0.3 + midterm * 0.25 + final * 0.25
    );

    const { error } = await supabase
      .from('grades')
      .update({ quizzes, summative, midterm, final, total_grade: totalGrade })
      .eq('id', selectedStudent.studentId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === selectedStudent.studentId
          ? { ...s, quizzes, summative, midterm, final, totalGrade }
          : s
      )
    );
    setIsEditDialogOpen(false);
    setSelectedStudent(null);
    toast.success('Grades updated successfully!');
  };

  const handleAddStudent = async () => {
    if (!subjectId) return;
    const number = addStudentForm.studentNumber.trim();
    if (!number) {
      toast.error('Student ID number is required');
      return;
    }

    // Only add if a student with this ID exists in profiles (registered students)
    const { data: profileData, error: lookupError } = await supabase
      .from('profiles')
      .select('id, full_name, student_number')
      .eq('role', 'student')
      .eq('student_number', number)
      .maybeSingle();

    if (lookupError) {
      toast.error('Could not look up student: ' + lookupError.message);
      return;
    }
    if (!profileData) {
      toast.error('No student found with that ID number. The student must be registered first.');
      return;
    }

    const quizzes = parseFloat(addStudentForm.quizzes) || 0;
    const summative = parseFloat(addStudentForm.summative) || 0;
    const midterm = parseFloat(addStudentForm.midterm) || 0;
    const final = parseFloat(addStudentForm.final) || 0;
    if ([quizzes, summative, midterm, final].some(s => s < 0 || s > 100)) {
      toast.error('Scores must be between 0 and 100');
      return;
    }
    const totalGrade = Math.round(
      quizzes * 0.2 + summative * 0.3 + midterm * 0.25 + final * 0.25
    );

    const { data: inserted, error } = await supabase
      .from('grades')
      .insert({
        subject_id: subjectId,
        student_profile_id: profileData.id,
        student_name: profileData.full_name,
        student_number: profileData.student_number,
        quizzes,
        summative,
        midterm,
        final,
        total_grade: totalGrade,
      })
      .select('id, student_name, student_number, quizzes, summative, midterm, final, total_grade')
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.error('This student is already in this subject.');
      } else {
        toast.error(error.message);
      }
      return;
    }
    setStudents((prev) => [
      ...prev,
      {
        studentId: inserted.id,
        studentName: inserted.student_name,
        studentNumber: inserted.student_number,
        quizzes: Number(inserted.quizzes),
        summative: Number(inserted.summative),
        midterm: Number(inserted.midterm),
        final: Number(inserted.final),
        totalGrade: Number(inserted.total_grade),
      },
    ]);
    setAddStudentForm({ studentNumber: '', quizzes: '0', summative: '0', midterm: '0', final: '0' });
    setAddStudentOpen(false);
    toast.success('Student added');
  };

  const openRemoveStudent = (student: StudentGrade) => {
    setStudentToRemove(student);
    setRemoveStudentOpen(true);
  };

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;
    const { error } = await supabase.from('grades').delete().eq('id', studentToRemove.studentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStudents((prev) => prev.filter(s => s.studentId !== studentToRemove.studentId));
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(`/section/${sectionId}`)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Subjects
        </Button>

        {/* Subject Header */}
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
            <div>Grading: <span className="font-medium text-gray-900">Quizzes 20% • Summative 30% • Midterm 25% • Final 25%</span></div>
          </div>
        </div>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Student Grades</CardTitle>
                <CardDescription>View and manage individual student scores. Add or remove students below.</CardDescription>
              </div>
              <Button onClick={() => setAddStudentOpen(true)} className="bg-[#48A111] hover:bg-[#3d8f0e] shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Quizzes (20%)</TableHead>
                    <TableHead className="text-center">Summative (30%)</TableHead>
                    <TableHead className="text-center">Midterm (25%)</TableHead>
                    <TableHead className="text-center">Final (25%)</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium">{student.studentNumber}</TableCell>
                      <TableCell>{student.studentName}</TableCell>
                      <TableCell className="text-center">{student.quizzes}%</TableCell>
                      <TableCell className="text-center">{student.summative}%</TableCell>
                      <TableCell className="text-center">{student.midterm}%</TableCell>
                      <TableCell className="text-center">{student.final}%</TableCell>
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

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Student Grades</DialogTitle>
              <DialogDescription>
                Update scores for {selectedStudent?.studentName} ({selectedStudent?.studentNumber})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="quizzes">Quizzes (20%)</Label>
                <Input
                  id="quizzes"
                  type="number"
                  min="0"
                  max="100"
                  value={editScores.quizzes}
                  onChange={(e) => setEditScores({ ...editScores, quizzes: e.target.value })}
                  placeholder="0-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="summative">Summative Tests (30%)</Label>
                <Input
                  id="summative"
                  type="number"
                  min="0"
                  max="100"
                  value={editScores.summative}
                  onChange={(e) => setEditScores({ ...editScores, summative: e.target.value })}
                  placeholder="0-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="midterm">Midterm Exam (25%)</Label>
                <Input
                  id="midterm"
                  type="number"
                  min="0"
                  max="100"
                  value={editScores.midterm}
                  onChange={(e) => setEditScores({ ...editScores, midterm: e.target.value })}
                  placeholder="0-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="final">Final Exam (25%)</Label>
                <Input
                  id="final"
                  type="number"
                  min="0"
                  max="100"
                  value={editScores.final}
                  onChange={(e) => setEditScores({ ...editScores, final: e.target.value })}
                  placeholder="0-100"
                />
              </div>
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

        {/* Add Student Dialog */}
        <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Student</DialogTitle>
              <DialogDescription>Enter the student&apos;s ID number. Only registered students (with that ID in the system) can be added. If no student has that ID, they will not be added.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-student-number">Student ID number (required)</Label>
                <Input
                  id="add-student-number"
                  value={addStudentForm.studentNumber}
                  onChange={(e) => setAddStudentForm((f) => ({ ...f, studentNumber: e.target.value }))}
                  placeholder="e.g. STU001 (must match a registered student)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-quizzes">Quizzes (20%)</Label>
                  <Input
                    id="add-quizzes"
                    type="number"
                    min="0"
                    max="100"
                    value={addStudentForm.quizzes}
                    onChange={(e) => setAddStudentForm((f) => ({ ...f, quizzes: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-summative">Summative (30%)</Label>
                  <Input
                    id="add-summative"
                    type="number"
                    min="0"
                    max="100"
                    value={addStudentForm.summative}
                    onChange={(e) => setAddStudentForm((f) => ({ ...f, summative: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-midterm">Midterm (25%)</Label>
                  <Input
                    id="add-midterm"
                    type="number"
                    min="0"
                    max="100"
                    value={addStudentForm.midterm}
                    onChange={(e) => setAddStudentForm((f) => ({ ...f, midterm: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-final">Final (25%)</Label>
                  <Input
                    id="add-final"
                    type="number"
                    min="0"
                    max="100"
                    value={addStudentForm.final}
                    onChange={(e) => setAddStudentForm((f) => ({ ...f, final: e.target.value }))}
                  />
                </div>
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

        {/* Remove Student Confirmation */}
        <AlertDialog open={removeStudentOpen} onOpenChange={setRemoveStudentOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove student?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove &quot;{studentToRemove?.studentName}&quot; ({studentToRemove?.studentNumber}) from this subject. Their grade record will be deleted. This cannot be undone.
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
