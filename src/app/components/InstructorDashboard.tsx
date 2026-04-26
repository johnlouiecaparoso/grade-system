import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
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
import { User, LogOut, Users, BookOpen, GraduationCapIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { UserAvatar } from './UserAvatar';
import { supabase } from '../../lib/supabase';

interface InstructorDashboardProps {
  onLogout: () => void;
}

interface Section {
  id: string;
  year: string;
  section: string;
  studentCount: number;
  subjectCount: number;
}

export default function InstructorDashboard({ onLogout }: InstructorDashboardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [totalStudentsFromGrades, setTotalStudentsFromGrades] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  const [deleteSectionOpen, setDeleteSectionOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionForm, setSectionForm] = useState({ year: '', section: '', studentCount: '' });

  const loadSections = useCallback(async () => {
    const { data: sectionsData, error: sectionsError } = await supabase
      .from('sections')
      .select('*')
      .order('year');
    if (sectionsError) {
      toast.error('Failed to load sections');
      setLoading(false);
      return;
    }
    const { data: subjectsData } = await supabase.from('subjects').select('id, section_id');
    const subjectCountBySection: Record<string, number> = {};
    const subjectToSection: Record<string, string> = {};
    (subjectsData || []).forEach((s: { id: string; section_id: string }) => {
      subjectCountBySection[s.section_id] = (subjectCountBySection[s.section_id] ?? 0) + 1;
      subjectToSection[s.id] = s.section_id;
    });
    const { data: gradesData } = await supabase.from('grades').select('subject_id, student_profile_id, student_number');
    const sectionStudentKeys: Record<string, Set<string>> = {};
    const allStudentKeys = new Set<string>();
    (gradesData || []).forEach((g: { subject_id: string; student_profile_id: string | null; student_number: string }) => {
      const key = g.student_profile_id ?? g.student_number;
      allStudentKeys.add(key);
      const secId = subjectToSection[g.subject_id];
      if (secId) {
        if (!sectionStudentKeys[secId]) sectionStudentKeys[secId] = new Set();
        sectionStudentKeys[secId].add(key);
      }
    });
    const list: Section[] = (sectionsData || []).map((s: { id: string; year: string; section: string }) => ({
      id: s.id,
      year: s.year,
      section: s.section,
      studentCount: sectionStudentKeys[s.id]?.size ?? 0,
      subjectCount: subjectCountBySection[s.id] ?? 0,
    }));
    setSections(list);
    setTotalStudentsFromGrades(allStudentKeys.size);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const uniqueYears = Array.from(new Set(sections.map((s) => s.year))).sort();

  const handleAddSection = async () => {
    const year = sectionForm.year.trim();
    const sectionName = sectionForm.section.trim();
    const studentCount = parseInt(sectionForm.studentCount, 10) || 0;
    if (!year || !sectionName) {
      toast.error('Year and section name are required');
      return;
    }
    const { error } = await supabase.from('sections').insert({
      year,
      section: sectionName,
      student_count: isNaN(studentCount) ? 0 : studentCount,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSectionForm({ year: '', section: '', studentCount: '' });
    setAddSectionOpen(false);
    toast.success('Section added');
    await loadSections();
  };

  const handleEditSection = async () => {
    if (!editingSection) return;
    const year = sectionForm.year.trim();
    const sectionName = sectionForm.section.trim();
    const studentCount = parseInt(sectionForm.studentCount, 10) || 0;
    if (!year || !sectionName) {
      toast.error('Year and section name are required');
      return;
    }
    const { error } = await supabase
      .from('sections')
      .update({ year, section: sectionName, student_count: isNaN(studentCount) ? 0 : studentCount })
      .eq('id', editingSection.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditSectionOpen(false);
    setEditingSection(null);
    toast.success('Section updated');
    loadSections();
  };

  const handleDeleteSection = async () => {
    if (!editingSection) return;
    const { error } = await supabase.from('sections').delete().eq('id', editingSection.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeleteSectionOpen(false);
    setEditingSection(null);
    toast.success('Section removed');
    loadSections();
  };

  const openEditSection = (section: Section) => {
    setEditingSection(section);
    setSectionForm({
      year: section.year,
      section: section.section,
      studentCount: section.studentCount.toString(),
    });
    setEditSectionOpen(true);
  };

  const openDeleteSection = (section: Section) => {
    setEditingSection(section);
    setDeleteSectionOpen(true);
  };

  const totalSections = sections.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <img src="/logo.png" alt="Logo" className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg shrink-0" />
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate">Grade Portal</h1>
                <p className="text-xs sm:text-sm text-gray-500">Instructor Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <UserAvatar avatarUrl={profile?.avatar_url} name={user?.name ?? 'User'} className="h-9 w-9 shrink-0" />
              <Button variant="outline" size="sm" className="text-sm hidden sm:flex" onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-1.5" />
                Profile
              </Button>
              <Button variant="outline" size="sm" className="text-sm" onClick={handleLogout}>
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
        <div className="mb-6 sm:mb-8 min-w-0">
          <h2 className="text-xl sm:text-3xl font-semibold text-gray-900 mb-2 break-words">
            Welcome, {user?.name ?? 'Instructor'}!
          </h2>
          <p className="text-sm sm:text-base text-gray-600 break-words">
            Select a year and section to manage student grades
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="overflow-visible">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-sm font-medium min-w-0">Total Sections</CardTitle>
              <GraduationCapIcon className="h-4 w-4 text-[#48A111] shrink-0" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-2xl font-semibold">{totalSections}</div>
              <p className="text-xs text-gray-600 mt-1">Active sections</p>
            </CardContent>
          </Card>
          <Card className="overflow-visible">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-sm font-medium min-w-0">Total Students</CardTitle>
              <Users className="h-4 w-4 text-[#48A111] shrink-0" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-2xl font-semibold">{totalStudentsFromGrades}</div>
              <p className="text-xs text-gray-600 mt-1">Across all sections</p>
            </CardContent>
          </Card>
          <Card className="overflow-visible">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-sm font-medium min-w-0">Academic Year</CardTitle>
              <BookOpen className="h-4 w-4 text-[#48A111] shrink-0" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-2xl font-semibold">2025-2026</div>
              <p className="text-xs text-gray-600 mt-1">Current semester</p>
            </CardContent>
          </Card>
        </div>

        {/* Sections by Year */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Sections</h3>
          <Button onClick={() => setAddSectionOpen(true)} className="bg-[#48A111] hover:bg-[#3d8f0e] shrink-0" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Section
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600">Loading sections...</p>
          </div>
        ) : uniqueYears.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <p className="text-gray-600 mb-4">No sections yet. Add a section to get started.</p>
            <Button onClick={() => setAddSectionOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add your first section
            </Button>
          </div>
        ) : (
          uniqueYears.map((year) => {
            const yearSections = sections.filter((s) => s.year === year);
            if (yearSections.length === 0) return null;

            return (
              <div key={year} className="mb-8">
                <h4 className="text-lg font-medium text-gray-700 mb-4">{year}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {yearSections.map((section) => (
                    <Card
                      key={section.id}
                      className="group hover:shadow-lg transition-shadow border-2 hover:border-[#48A111]/40"
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <Link
                            to={`/section/${section.id}`}
                            className="flex-1 min-w-0 cursor-pointer no-underline text-inherit"
                          >
                            <CardTitle className="text-lg hover:underline">{section.section}</CardTitle>
                            <CardDescription>{section.year}</CardDescription>
                          </Link>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100"
                              onClick={(e) => { e.preventDefault(); openEditSection(section); }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                              onClick={(e) => { e.preventDefault(); openDeleteSection(section); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <Badge className="bg-[#e8f5e0] text-[#2d6b0a] hover:bg-[#e8f5e0] shrink-0">
                            Active
                          </Badge>
                        </div>
                      </CardHeader>
                      <Link to={`/section/${section.id}`} className="block no-underline text-inherit">
                        <CardContent className="cursor-pointer hover:bg-gray-50/50 transition-colors rounded-b-lg">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600 flex items-center">
                                <Users className="w-4 h-4 mr-1" />
                                Students
                              </span>
                              <span className="font-medium">{section.studentCount}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600 flex items-center">
                                <BookOpen className="w-4 h-4 mr-1" />
                                Subjects
                              </span>
                              <span className="font-medium">{section.subjectCount}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Add Section Dialog */}
        <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Section</DialogTitle>
              <DialogDescription>Add a new section for a year. You can use any year label (e.g. 1st Year, 2nd Year).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-year">Year</Label>
                <Input
                  id="add-year"
                  value={sectionForm.year}
                  onChange={(e) => setSectionForm((f) => ({ ...f, year: e.target.value }))}
                  placeholder="e.g. 1st Year, 2nd Year"
                  list="year-list"
                />
                <datalist id="year-list">
                  {uniqueYears.map((y) => (
                    <option key={y} value={y} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-section">Section name</Label>
                <Input
                  id="add-section"
                  value={sectionForm.section}
                  onChange={(e) => setSectionForm((f) => ({ ...f, section: e.target.value }))}
                  placeholder="e.g. Section A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-students">Student count (optional)</Label>
                <Input
                  id="add-students"
                  type="number"
                  min="0"
                  value={sectionForm.studentCount}
                  onChange={(e) => setSectionForm((f) => ({ ...f, studentCount: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddSectionOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSection} className="bg-[#48A111] hover:bg-[#3d8f0e]">
                Add Section
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Section Dialog */}
        <Dialog open={editSectionOpen} onOpenChange={setEditSectionOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Section</DialogTitle>
              <DialogDescription>Change the year, section name, or student count.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-year">Year</Label>
                <Input
                  id="edit-year"
                  value={sectionForm.year}
                  onChange={(e) => setSectionForm((f) => ({ ...f, year: e.target.value }))}
                  placeholder="e.g. 1st Year"
                  list="edit-year-list"
                />
                <datalist id="edit-year-list">
                  {uniqueYears.map((y) => (
                    <option key={y} value={y} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-section">Section name</Label>
                <Input
                  id="edit-section"
                  value={sectionForm.section}
                  onChange={(e) => setSectionForm((f) => ({ ...f, section: e.target.value }))}
                  placeholder="e.g. Section A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-students">Student count</Label>
                <Input
                  id="edit-students"
                  type="number"
                  min="0"
                  value={sectionForm.studentCount}
                  onChange={(e) => setSectionForm((f) => ({ ...f, studentCount: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSectionOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSection} className="bg-[#48A111] hover:bg-[#3d8f0e]">
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Section Confirmation */}
        <AlertDialog open={deleteSectionOpen} onOpenChange={setDeleteSectionOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove section?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove &quot;{editingSection?.section}&quot; ({editingSection?.year}) and all its subjects and grade data. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSection} className="bg-red-600 hover:bg-red-700">
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
