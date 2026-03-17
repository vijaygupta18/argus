import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  UserPlus,
  Bell,
  BellOff,
  Clock,
  Loader2,
  Settings,
  X,
  Users,
  AlertCircle,
  Inbox,
  Mail,
  Search,
} from 'lucide-react';
import {
  fetchTeams,
  fetchTeamMembers,
  createTeam,
  updateTeam,
  deleteTeam,
  createMember,
  updateMember,
  deleteMember,
} from '../api/client';
import type {
  Team,
  Member,
  CreateTeamPayload,
  CreateMemberPayload,
  UpdateTeamPayload,
} from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import Avatar, { AvatarStack } from './Avatar';

function formatReminderFrequency(minutes: number): string {
  if (minutes < 60) return `Every ${minutes} min`;
  const hours = minutes / 60;
  if (hours === 1) return 'Every hour';
  if (Number.isInteger(hours)) return `Every ${hours} hours`;
  return `Every ${hours.toFixed(1)} hours`;
}

function formatStartHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-modal-backdrop" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 w-full max-w-md mx-4 animate-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">{message}</p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EditTeamModal({
  open,
  onClose,
  team,
}: {
  open: boolean;
  onClose: () => void;
  team: Team;
}) {
  const queryClient = useQueryClient();
  const [editForm, setEditForm] = useState<UpdateTeamPayload>({
    name: team.name,
    description: team.description,
    reminder_frequency_minutes: team.reminder_frequency_minutes,
    reminder_start_hour: team.reminder_start_hour,
    notifications_enabled: team.notifications_enabled,
  });

  const updateTeamMutation = useMutation({
    mutationFn: (payload: UpdateTeamPayload) => updateTeam(team.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-modal-backdrop" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 w-full max-w-lg mx-4 animate-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Edit Team Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateTeamMutation.mutate(editForm);
          }}
          className="p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Team Name</label>
            <input
              type="text"
              value={editForm.name || ''}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={editForm.description || ''}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Reminder Frequency (min)
              </label>
              <input
                type="number"
                min={5}
                value={editForm.reminder_frequency_minutes}
                onChange={(e) =>
                  setEditForm({ ...editForm, reminder_frequency_minutes: parseInt(e.target.value) || 60 })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Start Hour (0-23)
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={editForm.reminder_start_hour}
                onChange={(e) =>
                  setEditForm({ ...editForm, reminder_start_hour: parseInt(e.target.value) || 9 })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>
          {/* Toggle switch for notifications */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Notifications</p>
              <p className="text-xs text-slate-500 mt-0.5">Enable Slack reminders for this team</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={editForm.notifications_enabled}
              onClick={() => setEditForm({ ...editForm, notifications_enabled: !editForm.notifications_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                editForm.notifications_enabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                  editForm.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateTeamMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateTeamMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
          {updateTeamMutation.isError && (
            <p className="text-sm text-red-500">Failed to update team. Please try again.</p>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}

function AddTeamModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateTeamPayload>({
    name: '',
    description: '',
    reminder_frequency_minutes: 60,
    reminder_start_hour: 9,
    notifications_enabled: true,
  });

  const mutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setForm({
        name: '',
        description: '',
        reminder_frequency_minutes: 60,
        reminder_start_hour: 9,
        notifications_enabled: true,
      });
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-modal-backdrop" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 w-full max-w-lg mx-4 animate-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Create New Team</h3>
            <p className="text-xs text-slate-500 mt-0.5">Set up a team to manage issue assignments</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="e.g., Backend Team"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
              rows={2}
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Reminder Frequency (min)
              </label>
              <input
                type="number"
                min={5}
                value={form.reminder_frequency_minutes}
                onChange={(e) =>
                  setForm({ ...form, reminder_frequency_minutes: parseInt(e.target.value) || 60 })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Start Hour (0-23)
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={form.reminder_start_hour}
                onChange={(e) =>
                  setForm({ ...form, reminder_start_hour: parseInt(e.target.value) || 9 })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>
          {/* Toggle switch */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Notifications</p>
              <p className="text-xs text-slate-500 mt-0.5">Enable Slack reminders for this team</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.notifications_enabled}
              onClick={() => setForm({ ...form, notifications_enabled: !form.notifications_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                form.notifications_enabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                  form.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Team'
              )}
            </button>
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-500">Failed to create team. Please try again.</p>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}

function AddMemberOverlay({
  teamId,
  existingEmails,
  onClose,
}: {
  teamId: string;
  existingEmails: Set<string>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: CreateMemberPayload) => createMember(teamId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setSearch('');
      setError('');
      onClose();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || 'Failed to add member');
    },
  });

  const { data: allTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  });

  const { data: directory } = useQuery({
    queryKey: ['member-directory', allTeams?.map(t => t.id).join(',')],
    queryFn: async () => {
      if (!allTeams) return [];
      const seen = new Set<string>();
      const results: { name: string; email: string; slack_user_id: string }[] = [];
      for (const team of allTeams) {
        const members = await fetchTeamMembers(team.id);
        for (const m of members) {
          const key = m.email || m.slack_user_id;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ name: m.name, email: m.email || '', slack_user_id: m.slack_user_id });
          }
        }
      }
      return results;
    },
    enabled: !!allTeams && allTeams.length > 0,
  });

  const filtered = (directory || []).filter(p => {
    if (p.email && existingEmails.has(p.email)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  const handleAddByEmail = () => {
    const email = search.trim();
    if (!email || !email.includes('@')) return;
    mutation.mutate({ email });
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-modal-backdrop" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 w-full max-w-md mx-4 animate-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Add Member</h3>
            <p className="text-xs text-slate-500 mt-0.5">Search existing members or add by email</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setError(''); }}
              placeholder="Search by name or type email..."
              autoFocus
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Existing members section */}
          {filtered.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                From existing members
              </p>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 custom-scrollbar">
                {filtered.map((p) => (
                  <button
                    key={p.email || p.slack_user_id}
                    onClick={() => mutation.mutate({ email: p.email || undefined, name: p.name, slack_user_id: p.slack_user_id || undefined })}
                    disabled={mutation.isPending}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 disabled:opacity-50"
                  >
                    <Avatar name={p.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{p.name}</div>
                      {p.email && <div className="text-xs text-slate-400 truncate">{p.email}</div>}
                    </div>
                    {mutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : (
                      <Plus className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add by email section */}
          {filtered.length === 0 && search.trim() && (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Mail className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-xs text-slate-500 mb-3">No matching members found</p>
              {search.includes('@') && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Add by email
                  </p>
                  <button
                    onClick={handleAddByEmail}
                    disabled={mutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {mutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    Add {search.trim()}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

const TEAM_ACCENT_COLORS = [
  { border: 'border-l-blue-500', bg: 'bg-blue-500' },
  { border: 'border-l-emerald-500', bg: 'bg-emerald-500' },
  { border: 'border-l-violet-500', bg: 'bg-violet-500' },
  { border: 'border-l-amber-500', bg: 'bg-amber-500' },
  { border: 'border-l-rose-500', bg: 'bg-rose-500' },
  { border: 'border-l-cyan-500', bg: 'bg-cyan-500' },
];

function TeamCard({ team, index }: { team: Team; index: number }) {
  const queryClient = useQueryClient();
  const { isAdmin, canManageTeam } = useAuth();
  const canManage = canManageTeam(team.id);
  const [expanded, setExpanded] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteTeamConfirm, setShowDeleteTeamConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ['team-members', team.id],
    queryFn: () => fetchTeamMembers(team.id),
    enabled: expanded,
  });

  const { data: membersSummary } = useQuery<Member[]>({
    queryKey: ['team-members', team.id],
    queryFn: () => fetchTeamMembers(team.id),
  });

  const memberCount = membersSummary?.length ?? 0;
  const activeMembers = membersSummary?.filter(m => m.is_active) ?? [];
  const activeMemberCount = activeMembers.length;
  const openIssueCount = membersSummary?.reduce((sum, m) => sum + m.open_issue_count, 0) ?? 0;
  const resolvedCount = membersSummary?.reduce((sum, m) => sum + (m.total_assigned_count - m.open_issue_count), 0) ?? 0;
  const memberNames = activeMembers.map(m => m.name);

  const accent = TEAM_ACCENT_COLORS[index % TEAM_ACCENT_COLORS.length];

  const deleteTeamMutation = useMutation({
    mutationFn: () => deleteTeam(team.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowDeleteTeamConfirm(false);
    },
  });

  const toggleMemberActive = useMutation({
    mutationFn: ({ memberId, isActive }: { memberId: string; isActive: boolean }) =>
      updateMember(memberId, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
    },
  });

  const toggleMemberRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'leader' | 'worker' }) =>
      updateMember(memberId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => deleteMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setMemberToRemove(null);
    },
  });

  return (
    <>
      <div className={`bg-white rounded-2xl border border-slate-200/60 border-l-[5px] ${accent.border} overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
        {/* Card Header */}
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1">
                <h3 className="text-lg font-semibold text-slate-900 tracking-tight">{team.name}</h3>
                {team.notifications_enabled ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Bell className="w-3 h-3" />
                    On
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    <BellOff className="w-3 h-3" />
                    Off
                  </span>
                )}
              </div>
              {team.description && (
                <p className="text-sm text-slate-500 mb-3">{team.description}</p>
              )}
              {/* Visual stats row */}
              <div className="flex items-center gap-5 mt-3">
                <div className="flex items-center gap-2">
                  {memberNames.length > 0 ? (
                    <AvatarStack names={memberNames} max={3} size="xs" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                      <Users className="w-3 h-3 text-slate-400" />
                    </div>
                  )}
                  <span className="text-xs font-medium text-slate-600">
                    {activeMemberCount} member{activeMemberCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium text-slate-600">
                    {openIssueCount} open
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-slate-600">
                    {resolvedCount} resolved
                  </span>
                </div>
              </div>
              {/* Notification schedule */}
              <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                <span>
                  {formatReminderFrequency(team.reminder_frequency_minutes)}, starting at {formatStartHour(team.reminder_start_hour)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-3">
              {canManage && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Edit team"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteTeamConfirm(true)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete team"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Members
            {memberCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-600">
                {memberCount}
              </span>
            )}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Members section */}
        {expanded && (
          <div className="border-t border-slate-100 px-5 py-4">
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                {members && members.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className={`bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 transition-all duration-150 hover:border-slate-200 ${
                          !member.is_active ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar
                            name={member.name}
                            size="md"
                            className={!member.is_active ? 'grayscale' : ''}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold ${
                                member.is_active ? 'text-slate-900' : 'text-slate-400 line-through'
                              }`}>
                                {member.name}
                              </span>
                              {member.role === 'leader' ? (
                                <span
                                  onClick={() => isAdmin ? toggleMemberRole.mutate({ memberId: member.id, role: 'worker' }) : undefined}
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 ${isAdmin ? 'cursor-pointer hover:bg-violet-200' : ''}`}
                                  title={isAdmin ? 'Click to set as Worker' : 'Leader'}
                                >
                                  Leader
                                </span>
                              ) : (
                                isAdmin && (
                                  <span
                                    onClick={() => toggleMemberRole.mutate({ memberId: member.id, role: 'leader' })}
                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 cursor-pointer hover:bg-violet-100 hover:text-violet-700"
                                    title="Click to set as Leader"
                                  >
                                    Worker
                                  </span>
                                )
                              )}
                              {!member.is_active && (
                                <span className="text-[10px] font-medium text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
                                  Inactive
                                </span>
                              )}
                              {member.notifications_muted && (
                                <BellOff className="w-3 h-3 text-slate-300" />
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 truncate">
                              {member.email || member.slack_user_id}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-slate-500">
                                <span className="font-medium text-blue-600">{member.open_issue_count}</span> open
                              </span>
                              <span className="text-xs text-slate-500">
                                <span className="font-medium text-slate-700">{member.total_assigned_count}</span> total
                              </span>
                            </div>
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/60">
                            {/* Toggle switch */}
                            <button
                              onClick={() =>
                                toggleMemberActive.mutate({
                                  memberId: member.id,
                                  isActive: !member.is_active,
                                })
                              }
                              className="flex items-center gap-2 text-xs font-medium text-slate-500"
                            >
                              <div
                                role="switch"
                                aria-checked={member.is_active}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                                  member.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                                    member.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'
                                  }`}
                                />
                              </div>
                              <span>{member.is_active ? 'Active' : 'Inactive'}</span>
                            </button>
                            <div className="ml-auto">
                              <button
                                onClick={() => setMemberToRemove(member)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Remove member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No members yet</p>
                    {canManage && (
                      <p className="text-xs text-slate-400 mt-1">Add your first team member below</p>
                    )}
                  </div>
                )}

                {/* Add member button */}
                {canManage && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 mt-4 px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors w-full justify-center border border-dashed border-slate-200 hover:border-blue-300"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Member
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <ConfirmDialog
          open={showDeleteTeamConfirm}
          title="Delete Team"
          message={`Are you sure you want to delete ${team.name}? This will remove all team members and unassign any issues.`}
          confirmLabel="Delete Team"
          onConfirm={() => deleteTeamMutation.mutate()}
          onCancel={() => setShowDeleteTeamConfirm(false)}
          isPending={deleteTeamMutation.isPending}
        />

        <ConfirmDialog
          open={!!memberToRemove}
          title="Remove Member"
          message={memberToRemove ? `Remove ${memberToRemove.name} from ${team.name}?` : ''}
          confirmLabel="Remove"
          onConfirm={() => {
            if (memberToRemove) {
              removeMember.mutate(memberToRemove.id);
            }
          }}
          onCancel={() => setMemberToRemove(null)}
          isPending={removeMember.isPending}
        />
      </div>

      {showEditModal && (
        <EditTeamModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          team={team}
        />
      )}

      {showAddMember && (
        <AddMemberOverlay
          teamId={team.id}
          existingEmails={new Set(membersSummary?.map(m => m.email).filter(Boolean) as string[] || [])}
          onClose={() => setShowAddMember(false)}
        />
      )}
    </>
  );
}

export default function TeamManager() {
  const { isAdmin } = useAuth();
  const [showAddTeam, setShowAddTeam] = useState(false);

  const { data: teams, isLoading, error, refetch } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <p className="text-sm text-slate-400">Loading teams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-600 font-medium">Failed to load teams</p>
        <button
          onClick={() => refetch()}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const teamCount = teams?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Teams</h1>
              {teamCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                  {teamCount}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage teams and their members
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddTeam(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Team
          </button>
        )}
      </div>

      <AddTeamModal open={showAddTeam} onClose={() => setShowAddTeam(false)} />

      {teamCount > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {teams?.map((team, index) => (
            <TeamCard key={team.id} team={team} index={index} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/60">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">No teams yet</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            Create teams to organize your issue assignments and streamline your workflow.
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowAddTeam(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create your first team
            </button>
          )}
        </div>
      )}
    </div>
  );
}
