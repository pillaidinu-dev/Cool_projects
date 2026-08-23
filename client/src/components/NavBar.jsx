import { NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-rose-500 text-white' : 'text-slate-600 hover:bg-rose-50 hover:text-rose-600'
  }`;

export default function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤝</span>
          <span className="font-semibold text-slate-900">PlanSync</span>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            Feed
          </NavLink>
          <NavLink to="/create" className={linkClass}>
            Host
          </NavLink>
          <NavLink to="/mine" className={linkClass}>
            My Plans
          </NavLink>
          <NavLink to="/joined" className={linkClass}>
            Joined
          </NavLink>
          <NavLink to="/matches" className={linkClass}>
            Matches
          </NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden sm:inline">{user?.name}</span>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-rose-600 font-medium"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
