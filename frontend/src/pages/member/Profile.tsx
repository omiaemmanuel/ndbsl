import { useState, FormEvent } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage, LangToggleButton } from '../../contexts/LanguageContext';
import type { Lang } from '../../utils/i18n';

export default function Profile() {
  const { user } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/api/users/${user?.id}`, { username, phone: phone || null });
      toast.success(t('action.save'));
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/users/${user?.id}/password`, { password: newPassword });
      toast.success('Password changed');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.title')}</h1>

      {/* Account info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">{t('profile.accountInfo')}</h2>
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('profile.fullName')}</label>
            <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded border border-gray-200">{user?.fullName}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('profile.department')}</label>
            <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded border border-gray-200">{user?.department || '—'}</p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.phone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button type="submit" disabled={saving} className="bg-primary-600 text-white px-5 py-2 rounded-md text-sm hover:bg-primary-700 disabled:opacity-50">
            {saving ? t('action.saving') : t('action.save')}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">{t('profile.changePassword')}</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button type="submit" disabled={saving} className="bg-gray-800 text-white px-5 py-2 rounded-md text-sm hover:bg-gray-900 disabled:opacity-50">
            {saving ? t('action.saving') : t('profile.changePassword')}
          </button>
        </form>
      </div>

      {/* Language preference */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-1">{t('profile.langPref')}</h2>
        <p className="text-xs text-gray-500 mb-4">{t('profile.langDesc')}</p>
        <div className="flex gap-3">
          {(['en', 'ko'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                lang === l
                  ? 'border-primary-600 bg-primary-50 text-primary-700 shadow-sm'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {l === 'en' ? '🇺🇸 English' : '🇰🇷 한국어'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
