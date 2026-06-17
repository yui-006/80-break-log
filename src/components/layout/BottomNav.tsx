import { NavLink } from 'react-router-dom';
import { Home, ClipboardList, MapPin, BarChart2, Target } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',         label: 'ホーム', Icon: Home },
  { to: '/record',   label: '記録',   Icon: ClipboardList },
  { to: '/courses',  label: 'コース', Icon: MapPin },
  { to: '/analysis', label: '分析',   Icon: BarChart2 },
  { to: '/practice', label: '練習',   Icon: Target },
];

export function BottomNav() {
  return (
    <nav className="flex border-t border-ll-line bg-ll-surf safe-area-pb">
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-2 gap-0.5 text-xs font-medium transition-colors ${
              isActive ? 'text-ll-acc' : 'text-ll-dim'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
