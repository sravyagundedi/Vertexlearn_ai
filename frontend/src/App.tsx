import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import Instructor from './pages/Instructor';
import Admin from './pages/Admin';
import CourseDetails from './pages/CourseDetails';
import AiTutor from './pages/AiTutor';
import PersonalizedLearning from './pages/PersonalizedLearning';
import Quizzes from './pages/Quizzes';
import Summaries from './pages/Summaries';
import Flashcards from './pages/Flashcards';
import StudyPlan from './pages/StudyPlan';
import Progress from './pages/Progress';
import NotFound from './pages/NotFound';
import './styles.css';

function Private({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading VertexLearn…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'student' ? '/dashboard' : user.role === 'instructor' ? '/instructor' : '/admin'} replace />;
  }
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Private roles={['student']}><Dashboard /></Private>} />
          <Route path="/courses" element={<Private><Courses /></Private>} />
          <Route path="/courses/:id" element={<Private><CourseDetails /></Private>} />
          <Route path="/ai-tutor" element={<Private><AiTutor /></Private>} />
          <Route path="/learning" element={<Private><PersonalizedLearning /></Private>} />
          <Route path="/quizzes" element={<Private><Quizzes /></Private>} />
          <Route path="/summaries" element={<Private><Summaries /></Private>} />
          <Route path="/flashcards" element={<Private><Flashcards /></Private>} />
          <Route path="/study-plan" element={<Private><StudyPlan /></Private>} />
          <Route path="/progress" element={<Private><Progress /></Private>} />
          <Route path="/instructor" element={<Private roles={['instructor', 'admin']}><Instructor /></Private>} />
          <Route path="/admin" element={<Private roles={['admin']}><Admin /></Private>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
