import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import NavBar from './components/NavBar';
import AuthPage from './pages/AuthPage';
import Feed from './pages/Feed';
import CreatePlan from './pages/CreatePlan';
import MyPlans from './pages/MyPlans';
import JoinedPlans from './pages/JoinedPlans';
import Matches from './pages/Matches';
import Chat from './pages/Chat';

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      {children}
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/create" element={<CreatePlan />} />
        <Route path="/mine" element={<MyPlans />} />
        <Route path="/joined" element={<JoinedPlans />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/matches/:id" element={<Chat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
