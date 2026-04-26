import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
import { GraduationCapIcon, User, LogOut, ArrowLeft, BookOpen, Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { UserAvatar } from './UserAvatar';

interface SectionSubjectsProps {
  onLogout: () => void;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
  description: string;
}

interface Section {
  id: string;
  year: string;
  section: string;
  studentCount: number;
}

export default function SectionSubjects({ onLogout }: SectionSubjectsProps) {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const { user, profile } = useAuth();
  const [section, setSection] = useState<Section | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [deleteSubjectOpen, setDeleteSubjectOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', credits: '', description: '' });

  useEffect(() => {
    if (!sectionId) return;
    (async () => {
      const { data: sectionData, error: sectionError } = await supabase
        .from('sections')
        .select('*')
        .eq('id', sectionId)
        .maybeSingle();
      if (sectionError) {
        console.error('Section fetch error:', sectionError);
        toast.error('Could not load section: ' + sectionError.message);
        setSection(null);
        setLoading(false);
        return;
      }
      if (!sectionData) {
        setSection(null);
        setLoading(false);
        return;
      }
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('section_id', sectionId)
        .order('code');
      const subjectList = (subjectsData || []).map((s: { id: string; name: string; code: string; credits: number; description: string }) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        credits: s.credits ?? 0,
        description: s.description ?? '',
      }));
      setSubjects(subjectsError ? [] : subjectList);
      const subjectIds = (subjectsData || []).map((s: { id: string }) => s.id);
      let studentCount = 0;
      if (subjectIds.length > 0) {
        const { data: gradesData } = await supabase
          .from('grades')
          .select('student_profile_id, student_number')
          .in('subject_id', subjectIds);
        const keys = new Set<string>();
        (gradesData || []).forEach((g: { student_profile_id: string | null; student_number: string }) => {
          keys.add(g.student_profile_id ?? g.student_number);
        });
        studentCount = keys.size;
      }
      setSection({
        id: sectionData.id,
        year: sectionData.year,
        section: sectionData.section,
        studentCount,
      });
      setLoading(false);
    })();
  }, [sectionId]);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleAddSubject = async () => {
    if (!sectionId) return;
    const name = subjectForm.name.trim();
    const code = subjectForm.code.trim();
    const credits = parseInt(subjectForm.credits, 10);
    const description = subjectForm.description.trim();
    if (!name || !code) {
      toast.error('Subject name and code are required');
      return;
    }
    if (isNaN(credits) || credits < 0) {
      toast.error('Credits must be a non-negative number');
      return;
    }
    const { error } = await supabase.from('subjects').insert({
      section_id: sectionId,
      name,
      code,
      credits,
      description: description || '',
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubjectForm({ name: '', code: '', credits: '', description: '' });
    setAddSubjectOpen(false);
    toast.success('Subject added');
    const { data } = await supabase.from('subjects').select('*').eq('section_id', sectionId).order('code');
    setSubjects((data || []).map((s: { id: string; name: string; code: string; credits: number; description: string }) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      credits: s.credits ?? 0,
      description: s.description ?? '',
    })));
  };

  const handleEditSubject = async () => {
    if (!editingSubject) return;
    const name = subjectForm.name.trim();
    const code = subjectForm.code.trim();
    const credits = parseInt(subjectForm.credits, 10);
    const description = subjectForm.description.trim();
    if (!name || !code) {
      toast.error('Subject name and code are required');
      return;
    }
    if (isNaN(credits) || credits < 0) {
      toast.error('Credits must be a non-negative number');
      return;
    }
    const { error } = await supabase
      .from('subjects')
      .update({ name, code, credits, description: description || '' })
      .eq('id', editingSubject.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditSubjectOpen(false);
    setEditingSubject(null);
    toast.success('Subject updated');
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === editingSubject.id ? { ...s, name, code, credits, description } : s
      )
    );
  };

  const handleDeleteSubject = async () => {
    if (!editingSubject || !sectionId) return;
    const { error } = await supabase.from('subjects').delete().eq('id', editingSubject.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeleteSubjectOpen(false);
    setEditingSubject(null);
    setSubjects((prev) => prev.filter((s) => s.id !== editingSubject.id));
    toast.success('Subject removed');
  };

  const openEditSubject = (subject: Subject, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSubject(subject);
    setSubjectForm({
      name: subject.name,
      code: subject.code,
      credits: subject.credits.toString(),
      description: subject.description || '',
    });
    setEditSubjectOpen(true);
  };

  const openDeleteSubject = (subject: Subject, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSubject(subject);
    setDeleteSubjectOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-lg border shadow-sm p-8 max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Section not found</h2>
          <p className="text-gray-600 mb-6">This section may have been removed or you may not have access to it.</p>
          <Link to="/dashboard">
            <button className="px-4 py-2 bg-[#48A111] text-white rounded-md hover:bg-[#3d8f0e]">
              Back to Dashboard
            </button>
          </Link>
        </div>
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

        {/* Section Header */}
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900 mb-2">
                {section.year} - {section.section}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-base text-gray-600">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2 shrink-0" />
                  <span>{section.studentCount} Students</span>
                </div>
                <div className="flex items-center">
                  <BookOpen className="w-4 h-4 mr-2 shrink-0" />
                  <span>{subjects.length} Subjects</span>
                </div>
              </div>
            </div>
            <Badge className="bg-[#e8f5e0] text-[#2d6b0a] hover:bg-[#e8f5e0] shrink-0">
              Active Section
            </Badge>
          </div>
        </div>

        {/* Subjects */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Subjects</h3>
          <Button onClick={() => setAddSubjectOpen(true)} className="bg-[#48A111] hover:bg-[#3d8f0e] shrink-0" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Subject
          </Button>
        </div>

        {subjects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <p className="text-gray-600 mb-4">No subjects in this section. Add a subject to manage grades.</p>
            <Button onClick={() => setAddSubjectOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add your first subject
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => (
              <Card
                key={subject.id}
                className="group cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-[#48A111]/40"
                onClick={() => navigate(`/section/${sectionId}/subject/${subject.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg">{subject.name}</CardTitle>
                      <CardDescription>{subject.code}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={(e) => openEditSubject(subject, e)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                        onClick={(e) => openDeleteSubject(subject, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{subject.credits} Credits</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 line-clamp-2">{subject.description || 'No description'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Subject Dialog */}
        <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Subject</DialogTitle>
              <DialogDescription>Add a new subject to this section. You can rename or remove it later.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-subject-name">Subject name</Label>
                <Input
                  id="add-subject-name"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Data Structures & Algorithms"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-subject-code">Code</Label>
                <Input
                  id="add-subject-code"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. CS301"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-subject-credits">Credits</Label>
                <Input
                  id="add-subject-credits"
                  type="number"
                  min="0"
                  value={subjectForm.credits}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, credits: e.target.value }))}
                  placeholder="3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-subject-desc">Description (optional)</Label>
                <Input
                  id="add-subject-desc"
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddSubjectOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSubject} className="bg-[#48A111] hover:bg-[#3d8f0e]">
                Add Subject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Subject Dialog */}
        <Dialog open={editSubjectOpen} onOpenChange={setEditSubjectOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rename / Edit Subject</DialogTitle>
              <DialogDescription>Change the subject name, code, credits, or description.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-subject-name">Subject name</Label>
                <Input
                  id="edit-subject-name"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Data Structures & Algorithms"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subject-code">Code</Label>
                <Input
                  id="edit-subject-code"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. CS301"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subject-credits">Credits</Label>
                <Input
                  id="edit-subject-credits"
                  type="number"
                  min="0"
                  value={subjectForm.credits}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, credits: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subject-desc">Description (optional)</Label>
                <Input
                  id="edit-subject-desc"
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSubjectOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSubject} className="bg-[#48A111] hover:bg-[#3d8f0e]">
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Subject Confirmation */}
        <AlertDialog open={deleteSubjectOpen} onOpenChange={setDeleteSubjectOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove subject?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove &quot;{editingSubject?.name}&quot; ({editingSubject?.code}) and all grade data for this subject. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSubject} className="bg-red-600 hover:bg-red-700">
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
