interface Props {
  view: 'grid' | 'list';
  onChange: (v: 'grid' | 'list') => void;
}

export function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange('grid')}
        title="Grid view"
        className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white shadow text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="6" height="6" rx="1"/>
          <rect x="9" y="1" width="6" height="6" rx="1"/>
          <rect x="1" y="9" width="6" height="6" rx="1"/>
          <rect x="9" y="9" width="6" height="6" rx="1"/>
        </svg>
      </button>
      <button
        onClick={() => onChange('list')}
        title="List view"
        className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white shadow text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 16 16">
          <line x1="3" y1="4" x2="13" y2="4"/>
          <line x1="3" y1="8" x2="13" y2="8"/>
          <line x1="3" y1="12" x2="13" y2="12"/>
        </svg>
      </button>
    </div>
  );
}
