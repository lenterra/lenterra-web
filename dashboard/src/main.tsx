/**
 * Entry point.
 *
 * Routes are code-split so opening the roster does not load the student-detail
 * view or its evidence timeline (TRD-TCH-003). The budget is 200 KB gzipped for
 * the initial bundle, on a laptop several years old.
 */

import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { initI18n } from './i18n';
import { Shell } from './ui/Shell';
import { Loading } from './ui/State';
import './ui/tokens.css';

initI18n();

const Classes = lazy(() => import('./routes/classes'));
const ClassView = lazy(() => import('./routes/class'));
const StudentView = lazy(() => import('./routes/student'));
const SignIn = lazy(() => import('./routes/signin'));

/**
 * Hash routing.
 *
 * GitHub Pages serves static files with no rewrite rule, so a deep link to
 * `/dashboard/class/abc` on a hard refresh would 404. A hash keeps every route
 * reachable from a bookmark, which is how a teacher will actually return to
 * their class.
 */
const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Classes /> },
      { path: 'class/:classId', element: <ClassView /> },
      { path: 'class/:classId/student/:userId', element: <StudentView /> },
      { path: 'signin', element: <SignIn /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Never retry a refusal: a teacher who cannot see a class will not be
        // able to see it on the third attempt either.
        const code = (error as { code?: string })?.code;
        if (code === 'FORBIDDEN' || code === 'UNAUTHENTICATED' || code === 'NOT_FOUND') return false;
        return failureCount < 2;
      },
    },
  },
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<Loading />}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>,
);
