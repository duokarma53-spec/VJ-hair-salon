import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Services from './pages/Services';
import Calendar from './pages/Calendar';
import Inventory from './pages/Inventory';
import Staff from './pages/Staff';
import Accounts from './pages/Accounts';
import Expenses from './pages/Expenses';
import Packages from './pages/Packages';
import Appointments from './pages/Appointments';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

// Placeholders for other pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex h-[50vh] items-center justify-center">
    <h2 className="text-2xl font-semibold text-muted-foreground">{title} Module Coming Soon</h2>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-right" />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="appointments" element={<Appointments />} />
                <Route path="customers" element={<Customers />} />
                <Route path="services" element={<Services />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="staff" element={<Staff />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="packages" element={<Packages />} />
                <Route path="reports" element={<Placeholder title="Reports" />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
