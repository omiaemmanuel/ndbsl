import { useState, useEffect } from 'react';

// ── Help content definitions ──────────────────────────────────────────────────

type HelpRole = 'member' | 'professor' | 'admin' | 'super_admin';

interface HelpItem {
  q: string;
  a: string;
}

interface HelpCategory {
  id: string;
  label: string;
  items: HelpItem[];
}

const MEMBER_HELP: HelpCategory[] = [
  {
    id: 'requests',
    label: 'Procurement Requests',
    items: [
      { q: 'How do I submit a new procurement request?', a: 'Go to My Requests → click "New Request". Fill in the title, justification, priority, and add your items (name, quantity, unit cost). If your total exceeds ₩20,000 you must check the "Professor\'s Approval" checkbox. Submit when ready.' },
      { q: 'What happens after I submit a request?', a: 'Your request goes to Pending status. The professor reviews it and may approve, decline, or send you a query. You\'ll see a discussion thread appear on your request if the professor has questions.' },
      { q: 'I got a query from the professor — how do I respond?', a: 'Open My Requests and find the request with status "Queried". Click "View Discussion" to see the professor\'s message and type your reply.' },
      { q: 'Can I edit my request after submitting?', a: 'You can edit a request only while it is still in Pending status. Once approved or actioned, it is locked.' },
    ],
  },
  {
    id: 'equipment',
    label: 'Equipment & Bookings',
    items: [
      { q: 'How do I book equipment?', a: 'Go to Equipment, find the item you want, and click on it. Switch to the "Book" tab. Click on your start date, then your end date on the calendar — the system will set 9 AM start and 5 PM end automatically. Enter your purpose and confirm.' },
      { q: 'The equipment shows "In Use" — can I still book it?', a: 'Yes. Click the equipment and use the calendar to select dates after the current booking ends. The currently booked dates will appear grayed out.' },
      { q: 'How do I cancel a booking?', a: 'Go to My Bookings and click "Cancel" next to the booking. You can only cancel bookings that have not yet started.' },
      { q: 'What do I do if equipment is broken?', a: 'On the Equipment page, click the item then click "Report Fault" — or go directly to Report Fault in the sidebar. Describe the problem and severity.' },
    ],
  },
  {
    id: 'consumables',
    label: 'Consumables',
    items: [
      { q: 'How do I request a consumable?', a: 'Go to Consumables. You can either request a restock of an existing item (select the item and enter quantity) or request a new item to be added to inventory.' },
      { q: 'What is the difference between Restock and New Item?', a: '"Restock" adds more quantity to an existing consumable already in the lab inventory. "New Item" requests the lab to purchase and add something new.' },
    ],
  },
  {
    id: 'pulse',
    label: 'Research Pulse',
    items: [
      { q: 'When should I submit my weekly report?', a: 'Reports should be submitted by Friday 11:59 PM (KST). Late submissions are accepted but marked with a "Late" badge.' },
      { q: 'What goes in each section?', a: '• Accomplishments: key results, completed experiments, milestones reached.\n• Challenges: specific blockers or technical difficulties — be precise so the Professor can help.\n• Next Week\'s Objectives: 2–4 concrete, actionable goals.\n• Reading List: optional — papers or books you are studying.' },
      { q: 'Can I add photos to my report?', a: 'Yes — click "Add Images" in the form to upload multiple images. Each image can have an optional caption. The Professor can slide through them in the review panel.' },
      { q: 'What does "Share with lab feed" mean?', a: 'Checking this makes your accomplishments visible on the public Lab Feed page, visible to all lab members.' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile & Settings',
    items: [
      { q: 'How do I change my password?', a: 'Go to Profile → enter your new password and confirm it → Save.' },
      { q: 'How do I switch the app language?', a: 'In the Profile page, find the Language Preference section and click EN or 한국어. You can also use the toggle button at the bottom of the sidebar.' },
    ],
  },
];

const PROFESSOR_HELP: HelpCategory[] = [
  {
    id: 'requests',
    label: 'Request Review',
    items: [
      { q: 'How do I review procurement requests?', a: 'Go to Request Review. Requests in Pending status are awaiting your action. Expand a row to see the full item list, justification, and priority. You can Approve, Decline, or Query.' },
      { q: 'What does the "Query" action do?', a: 'Querying a request sends a message to the member asking for more information. The request status changes to "Queried". You will see a "Replied" badge when the member responds.' },
      { q: 'Can I see all procurement history?', a: 'Go to Procurement Review. This shows approved, ordered, and delivered requests. Use the "Show Archived" toggle to see older records.' },
    ],
  },
  {
    id: 'pulse',
    label: 'Research Pulse',
    items: [
      { q: 'How do I review a member\'s weekly report?', a: 'Go to Research Pulse → "All Reports" tab. Find the report and click it to open the side-by-side review panel. The report content is on the left, comments on the right.' },
      { q: 'How do I leave a targeted comment on a specific sentence?', a: 'Select (highlight) any text in the report with your mouse. A quote reference will appear in the comment box on the right. Type your comment and submit — it will be linked to the highlighted text.' },
      { q: 'How do I view the research images a member attached?', a: 'If the member uploaded images, you\'ll see a "Research Visuals" section in the report panel with left/right arrows to slide through them.' },
      { q: 'How do I mark a report as reviewed?', a: 'Click the green "Mark as Reviewed" button in the review panel. This updates the report status and notifies the member.' },
      { q: 'How do I request a meeting with a member?', a: 'In the review panel, click "Request Meeting". This creates a meeting request linked to that report.' },
      { q: 'Where can I see who has not submitted this week?', a: 'Go to Research Pulse → "This Week" tab. Cards show each member with a green check (submitted) or gray dot (not submitted).' },
    ],
  },
  {
    id: 'expenditure',
    label: 'Expenditure',
    items: [
      { q: 'How do I view the expenditure report?', a: 'Go to Expenditure. Select the year from the dropdown. The bar chart shows monthly spend and the table lists every ordered/delivered request.' },
      { q: 'How do I print the expenditure report?', a: 'Select the year then click "Print Report". This opens the print dialog with a two-page formatted report — a summary page with key metrics and a detailed request list.' },
      { q: 'Why is an item not appearing in the report?', a: 'The expenditure report only includes requests with status "ordered" or "delivered". Pending, approved, or declined requests are excluded.' },
    ],
  },
];

const ADMIN_HELP: HelpCategory[] = [
  {
    id: 'users',
    label: 'User Management',
    items: [
      { q: 'How do I add a new lab member?', a: 'Go to Users → click "Add New User". Fill in the Full Name, Username, Password, Department, and Role. The user can log in immediately with the credentials you set.' },
      { q: 'How do I reset a user\'s password?', a: 'Go to Users, find the user, click Edit, and set a new password in the password field.' },
      { q: 'What is "View as Member"?', a: 'This is the impersonation feature. Clicking it lets you see the member portal exactly as that user sees it. A yellow banner at the top will remind you that you\'re in impersonation mode. All actions taken during impersonation are recorded in the Audit Log.' },
      { q: 'How do I deactivate a user account?', a: 'Edit the user and toggle "Active" to off. The user will not be able to log in but their data is preserved.' },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    items: [
      { q: 'How do I mark a request as ordered or delivered?', a: 'Go to Requests (or Procurement). Find the approved request and click "Mark as Ordered". Once the items arrive, click "Mark as Delivered".' },
      { q: 'Can I delete a procurement request?', a: 'Yes, but it is permanent. Click Delete and confirm the warning dialog. Consider archiving instead to keep a record.' },
      { q: 'How does auto-archiving work?', a: 'Procurement requests with status delivered, declined, or cancelled that are older than 6 months are automatically archived daily. You can always unarchive them.' },
    ],
  },
  {
    id: 'equipment',
    label: 'Equipment & Bookings',
    items: [
      { q: 'How do I add new equipment?', a: 'Go to Equipment → Add New Equipment. Fill in name, category, room, model/serial, and booking settings (max duration, advance limit, minimum notice).' },
      { q: 'Can I delete equipment that has active bookings?', a: 'No — the system blocks deletion if there are future confirmed bookings. Cancel those bookings first, then delete.' },
      { q: 'How are expired bookings handled?', a: 'An automated job runs every hour and marks bookings as "completed" and archives them when their end time has passed.' },
    ],
  },
  {
    id: 'consumables',
    label: 'Consumables',
    items: [
      { q: 'How do I approve a restock request?', a: 'Go to Consumables → scroll to Consumable Requests. Click "Approve" on a restock request — this automatically adds the requested quantity to the current stock.' },
      { q: 'How do I handle a "new item" request?', a: 'When you approve a new item request, the system will ask if you want to add it to inventory. If you confirm, it opens an add-consumable form pre-filled with the item details.' },
      { q: 'What triggers the Low Stock warning?', a: 'Any consumable where current_stock is at or below its reorder_threshold shows as "Low Stock". Items at 0 show as "Out of Stock".' },
    ],
  },
  {
    id: 'announcements',
    label: 'Announcements',
    items: [
      { q: 'How do I create an announcement?', a: 'Go to Announcements → Add New. Set a title, content, visible from/until dates, and optionally attach files (PDF, PNG, JPEG, DOCX up to 20MB each). Members can download attached files.' },
      { q: 'How does the "New" badge work?', a: 'Announcements created within the last 3 days automatically show a "New" badge on the home page and member portal.' },
      { q: 'Can I schedule announcements?', a: 'Yes — set the "Visible From" date in the future. The announcement won\'t appear until that date. Set "Visible Until" to make it disappear automatically.' },
    ],
  },
  {
    id: 'audit',
    label: 'Audit & Reports',
    items: [
      { q: 'What is logged in the Audit Log?', a: 'All significant actions: logins, user creation/edit/delete, procurement status changes, booking actions, impersonation sessions, and more.' },
      { q: 'Can I export the audit log?', a: 'Yes — the Audit Log page has a CSV export button. Use the date range and user filters to narrow down before exporting.' },
      { q: 'How do I print the expenditure report?', a: 'Go to Expenditure, select the year, and click "Print Report". A formatted two-page PDF-ready report will be sent to your printer: a summary page and a detailed request list, both with the NBSL logo.' },
    ],
  },
];

// Map role to help categories
const helpByRole: Record<HelpRole, HelpCategory[]> = {
  member: MEMBER_HELP,
  professor: PROFESSOR_HELP,
  admin: ADMIN_HELP,
  super_admin: ADMIN_HELP,
};

// ── HelpPanel component ───────────────────────────────────────────────────────
interface HelpPanelProps {
  role: HelpRole;
  onClose: () => void;
}

export function HelpPanel({ role, onClose }: HelpPanelProps) {
  const categories = helpByRole[role] ?? MEMBER_HELP;
  const [activeTab, setActiveTab] = useState(categories[0]?.id ?? '');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const activeCategory = categories.find((c) => c.id === activeTab);

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="font-semibold text-gray-900">Help Center</h2>
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full capitalize">{role.replace('_', ' ')}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close help"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 overflow-x-auto shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Q&A accordion */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {activeCategory?.items.map((item, i) => {
            const key = `${activeTab}-${i}`;
            const open = openItems.has(key);
            return (
              <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleItem(key)}
                  className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800 leading-snug">{item.q}</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1">
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-400 text-center">
            NDBSL Lab Management System · For additional help, contact the lab administrator.
          </p>
        </div>
      </div>
    </>
  );
}

// ── HelpButton — floating trigger ─────────────────────────────────────────────
interface HelpButtonProps {
  role: HelpRole;
}

export function HelpButton({ role }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 w-11 h-11 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        aria-label="Open help"
        title="Help"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && <HelpPanel role={role} onClose={() => setOpen(false)} />}
    </>
  );
}
