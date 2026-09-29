import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { ConfirmProvider, ToastProvider } from './components/ui';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
