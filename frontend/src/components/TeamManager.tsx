import { useState } from 'react';
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
  Check,
  Users,
  AlertCircle,
  Inbox,
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">{message}</p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Add Team</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="p-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="e.g., Backend Team"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              rows={2}
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reminder (min)
              </label>
              <input
                type="number"
                min={5}
                value={form.reminder_frequency_minutes}
                onChange={(e) =>
                  setForm({ ...form, reminder_frequency_minutes: parseInt(e.target.value) || 60 })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start Hour
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={form.reminder_start_hour}
                onChange={(e) =>
                  setForm({ ...form, reminder_start_hour: parseInt(e.target.value) || 9 })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.notifications_enabled}
              onChange={(e) => setForm({ ...form, notifications_enabled: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Enable notifications</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? 'Creating...' : 'Create Team'}
            </button>
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-500">
              Failed to create team. Please try again.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function AddMemberForm({
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

  // Fetch all members from all teams to build a searchable directory
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
    // Don't show people already in this team
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

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-slate-700">Add Member</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setError(''); }}
          placeholder="Search by name or type email..."
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-100">
          {filtered.map((p) => (
            <button
              key={p.email || p.slack_user_id}
              onClick={() => mutation.mutate({ email: p.email || undefined, name: p.name, slack_user_id: p.slack_user_id || undefined })}
              disabled={mutation.isPending}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-b-0 disabled:opacity-50"
            >
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">{p.name}</div>
                {p.email && <div className="text-xs text-slate-400 truncate">{p.email}</div>}
              </div>
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          ))}
          {filtered.length === 0 && search.trim() && (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-slate-400 mb-2">No existing members found</p>
              {search.includes('@') && (
                <button
                  onClick={handleAddByEmail}
                  disabled={mutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                  Add {search.trim()} to team
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberRoleBadge({ role }: { role: 'leader' | 'worker' | null }) {
  if (!role) return null;
  const colors = {
    leader: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    worker: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[role]}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function TeamCard({ team }: { team: Team }) {
  const queryClient = useQueryClient();
  const { isAdmin, canManageTeam } = useAuth();
  const canManage = canManageTeam(team.id);
  const [expanded, setExpanded] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDeleteTeamConfirm, setShowDeleteTeamConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState<UpdateTeamPayload>({
    name: team.name,
    description: team.description,
    reminder_frequency_minutes: team.reminder_frequency_minutes,
    reminder_start_hour: team.reminder_start_hour,
    notifications_enabled: team.notifications_enabled,
  });

  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ['team-members', team.id],
    queryFn: () => fetchTeamMembers(team.id),
    enabled: expanded,
  });

  // Also fetch members for summary counts (lightweight fetch)
  const { data: membersSummary } = useQuery<Member[]>({
    queryKey: ['team-members', team.id],
    queryFn: () => fetchTeamMembers(team.id),
  });

  const memberCount = membersSummary?.length ?? 0;
  const activeMembers = membersSummary?.filter(m => m.is_active).length ?? 0;
  const openIssueCount = membersSummary?.reduce((sum, m) => sum + m.open_issue_count, 0) ?? 0;

  const updateTeamMutation = useMutation({
    mutationFn: (payload: UpdateTeamPayload) => updateTeam(team.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditing(false);
    },
  });

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

  const removeMember = useMutation({
    mutationFn: (memberId: string) => deleteMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setMemberToRemove(null);
    },
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors">
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateTeamMutation.mutate(editForm);
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Description"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Reminder (min)</label>
                    <input
                      type="number"
                      min={5}
                      value={editForm.reminder_frequency_minutes}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          reminder_frequency_minutes: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Start Hour</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={editForm.reminder_start_hour}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          reminder_start_hour: parseInt(e.target.value) || 9,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.notifications_enabled}
                    onChange={(e) =>
                      setEditForm({ ...editForm, notifications_enabled: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Notifications enabled</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updateTeamMutation.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{team.name}</h3>
                  {team.notifications_enabled ? (
                    <Bell className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <BellOff className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
                {team.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{team.description}</p>
                )}
                {/* Summary stats row */}
                <div className="flex items-center gap-4 mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    {activeMembers} member{activeMembers !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {openIssueCount} open issue{openIssueCount !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    Every {team.reminder_frequency_minutes}m
                  </span>
                </div>
              </>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {canManage && (
                <button
                  onClick={() => {
                    setEditForm({
                      name: team.name,
                      description: team.description,
                      reminder_frequency_minutes: team.reminder_frequency_minutes,
                      reminder_start_hour: team.reminder_start_hour,
                      notifications_enabled: team.notifications_enabled,
                    });
                    setEditing(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Edit team"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteTeamConfirm(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete team"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Members {memberCount > 0 ? `(${memberCount})` : ''}
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
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-1">
              {members?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      member.is_active
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            member.is_active ? 'text-slate-900' : 'text-slate-400 line-through'
                          }`}
                        >
                          {member.name}
                        </span>
                        {!member.is_active && (
                          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            Inactive
                          </span>
                        )}
                        {member.notifications_muted && (
                          <BellOff className="w-3 h-3 text-slate-300" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {member.email && <span>{member.email}</span>}
                        {!member.email && <span>{member.slack_user_id}</span>}
                        <span className="text-slate-300">|</span>
                        <span>
                          {member.open_issue_count} open / {member.total_assigned_count} total
                        </span>
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() =>
                          toggleMemberActive.mutate({
                            memberId: member.id,
                            isActive: !member.is_active,
                          })
                        }
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                          member.is_active
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'text-green-700 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {member.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => setMemberToRemove(member)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {members?.length === 0 && (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No members yet</p>
                  {canManage && (
                    <p className="text-xs text-slate-300 mt-1">Add your first team member below</p>
                  )}
                </div>
              )}

              {/* Add member */}
              {canManage && (
                <>
                  {showAddMember ? (
                    <AddMemberForm teamId={team.id} existingEmails={new Set(members?.map(m => m.email).filter(Boolean) as string[] || [])} onClose={() => setShowAddMember(false)} />
                  ) : (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 mt-3 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add Member
                    </button>
                  )}
                </>
              )}
            </div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Teams</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage teams and their members
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddTeam(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Team
          </button>
        )}
      </div>

      <AddTeamModal open={showAddTeam} onClose={() => setShowAddTeam(false)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {teams?.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>

      {teams?.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No teams created yet</p>
          <p className="text-xs text-slate-400 mt-1">Create teams to organize your issue assignments</p>
          {isAdmin && (
            <button
              onClick={() => setShowAddTeam(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
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
