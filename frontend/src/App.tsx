import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ProtectedRoute } from './components/ui/ProtectedRoute';
import { usePushNotifications } from './hooks/usePushNotifications';

function PushInit() {
  usePushNotifications();
  return null;
}

// Public
import Landing from './pages/Landing';
import Login from './pages/Login';
import LabFeed, { LabFeedEmbedded } from './pages/LabFeed';

// Member
import MemberLayout from './pages/member/MemberLayout';
import MemberOverview from './pages/member/Overview';
import MyRequests from './pages/member/MyRequests';
import NewRequest from './pages/member/NewRequest';
import MemberEquipment from './pages/member/Equipment';
import MyBookings from './pages/member/MyBookings';
import MemberConsumables from './pages/member/Consumables';
import ReportFault from './pages/member/ReportFault';
import MemberAnnouncements from './pages/member/Announcements';
import MemberResearchPulse from './pages/member/ResearchPulse';
import Profile from './pages/member/Profile';

// Professor
import ProfessorLayout from './pages/professor/ProfessorLayout';
import RequestReview from './pages/professor/RequestReview';
import ProcurementReview from './pages/professor/ProcurementReview';
import ProfessorExpenditure from './pages/professor/Expenditure';
import ProfessorResearchPulse from './pages/professor/ResearchPulse';

// Admin
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/Overview';
import Users from './pages/admin/Users';
import AdminRequests from './pages/admin/Requests';
import AdminEquipment from './pages/admin/Equipment';
import AdminBookings from './pages/admin/Bookings';
import AdminConsumables from './pages/admin/Consumables';
import AdminFaults from './pages/admin/Faults';
import ResearchProjects from './pages/admin/ResearchProjects';
import Announcements from './pages/admin/Announcements';
import Queries from './pages/admin/Queries';
import AdminExpenditure from './pages/admin/Expenditure';
import AuditLog from './pages/admin/AuditLog';
import MemberView from './pages/admin/MemberView';

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <PushInit />
          <Toaster position="top-right" />
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/lab-feed" element={<LabFeed />} />

            {/* Member */}
            <Route
              path="/member"
              element={
                <ProtectedRoute role="member">
                  <MemberLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<MemberOverview />} />
              <Route path="requests" element={<MyRequests />} />
              <Route path="requests/new" element={<NewRequest />} />
              <Route path="equipment" element={<MemberEquipment />} />
              <Route path="bookings" element={<MyBookings />} />
              <Route path="consumables" element={<MemberConsumables />} />
              <Route path="faults" element={<ReportFault />} />
              <Route path="announcements" element={<MemberAnnouncements />} />
              <Route path="research-pulse" element={<MemberResearchPulse />} />
              <Route path="lab-feed" element={<LabFeedEmbedded />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Professor */}
            <Route
              path="/professor"
              element={
                <ProtectedRoute role="professor">
                  <ProfessorLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="requests" replace />} />
              <Route path="requests" element={<RequestReview />} />
              <Route path="procurement" element={<ProcurementReview />} />
              <Route path="expenditure" element={<ProfessorExpenditure />} />
              <Route path="research-pulse" element={<ProfessorResearchPulse />} />
              <Route path="lab-feed" element={<LabFeedEmbedded />} />
            </Route>

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminOverview />} />
              <Route path="users" element={<Users />} />
              <Route path="procurement" element={<AdminRequests />} />
              <Route path="equipment" element={<AdminEquipment />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="consumables" element={<AdminConsumables />} />
              <Route path="faults" element={<AdminFaults />} />
              <Route path="research" element={<ResearchProjects />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="queries" element={<Queries />} />
              <Route path="expenditure" element={<AdminExpenditure />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="member-view/:userId" element={<MemberView />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}
