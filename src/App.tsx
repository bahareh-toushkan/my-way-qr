import { lazy, Suspense } from 'react';
import Home from './pages/Home';

const Kiosk = lazy(() => import('./pages/Kiosk'));
const Me = lazy(() => import('./pages/Me'));
const Eval = lazy(() => import('./pages/Eval'));

export default function App() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  let page = <Home />;
  if (path === '/kiosk') page = <Kiosk />;
  else if (path === '/me') page = <Me />;
  else if (path === '/eval') page = <Eval />;
  return <Suspense fallback={<div className="boot">…</div>}>{page}</Suspense>;
}
