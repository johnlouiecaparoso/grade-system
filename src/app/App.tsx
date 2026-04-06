import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import InstructorDashboard from './components/InstructorDashboard';
import SectionSubjects from './components/SectionSubjects';
import InstructorSubjectView from './components/InstructorSubjectView';
import Profile from './components/Profile';
import SubjectDetail from './components/SubjectDetail';
import JoinSubject from './components/JoinSubject';
import { Toaster } from './components/ui/sonner';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user, loading, signOut } = useAuth();
  const isAuthenticated = !!user;
  const userRole = user?.role ?? '';

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <Toaster />
      <Routes>
        <Route 
          path="/login" 
          element={<Login />} 
        />
        <Route 
          path="/register" 
          element={<Register />} 
        />
        <Route 
          path="/dashboard" 
          element={
            isAuthenticated ? (
              userRole === 'instructor' ? <InstructorDashboard onLogout={handleLogout} /> : <Dashboard onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        <Route 
          path="/section/:sectionId" 
          element={isAuthenticated && userRole === 'instructor' ? <SectionSubjects onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/section/:sectionId/subject/:subjectId" 
          element={isAuthenticated && userRole === 'instructor' ? <InstructorSubjectView onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/profile" 
          element={isAuthenticated ? <Profile onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/subject/:subjectId" 
          element={isAuthenticated && userRole === 'student' ? <SubjectDetail onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route
          path="/join"
          element={isAuthenticated && userRole === 'student' ? <JoinSubject onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/join/:token"
          element={isAuthenticated && userRole === 'student' ? <JoinSubject onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
