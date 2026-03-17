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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Backend Team"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reminder Frequency (min)
              </label>
              <input
                type="number"
                min={5}
                value={form.reminder_frequency_minutes}
                onChange={(e) =>
                  setForm({ ...form, reminder_frequency_minutes: parseInt(e.target.value) || 60 })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reminder Start Hour
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={form.reminder_start_hour}
                onChange={(e) =>
                  setForm({ ...form, reminder_start_hour: parseInt(e.target.value) || 9 })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
  onClose,
}: {
  teamId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateMemberPayload>({
    name: '',
    slack_user_id: '',
    email: '',
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateMemberPayload) => createMember(teamId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setForm({ name: '', slack_user_id: '', email: '' });
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
      className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name *"
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="text"
          required
          value={form.slack_user_id}
          onChange={(e) => setForm({ ...form, slack_user_id: e.target.value })}
          placeholder="Slack User ID *"
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="email"
          value={form.email || ''}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Email (optional)"
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={mutation.isPending || !form.name.trim() || !form.slack_user_id.trim()}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Adding...' : 'Add Member'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function MemberRoleBadge({ role }: { role: 'leader' | 'worker' | null }) {
  if (!role) return null;
  const colors = {
    leader: 'bg-blue-100 text-blue-700',
    worker: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${colors[role]}`}>
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
    },
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Description"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Reminder Frequency (min)</label>
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
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h3 className="text-base font-semibold text-slate-900">{team.name}</h3>
                {team.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{team.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Every {team.reminder_frequency_minutes}m from {team.reminder_start_hour}:00
                  </span>
                  <span className="flex items-center gap-1">
                    {team.notifications_enabled ? (
                      <Bell className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <BellOff className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    {team.notifications_enabled ? 'Notifications on' : 'Notifications off'}
                  </span>
                </div>
              </>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-1">
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title="Edit team"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    if (window.confirm(`Delete team "${team.name}"?`)) {
                      deleteTeamMutation.mutate();
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
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
        className="w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Members {members ? `(${members.length})` : ''}
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
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-2">
              {members?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50"
                >
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
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                      {member.notifications_muted && (
                        <BellOff className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                      <span>{member.slack_user_id}</span>
                      {member.email && <span>{member.email}</span>}
                      <span>
                        {member.open_issue_count} open / {member.total_assigned_count} total
                      </span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          toggleMemberActive.mutate({
                            memberId: member.id,
                            isActive: !member.is_active,
                          })
                        }
                        className={`px-2 py-1 text-xs font-medium rounded-lg ${
                          member.is_active
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'text-green-700 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {member.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove "${member.name}" from this team?`)) {
                            removeMember.mutate(member.id);
                          }
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {members?.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">
                  No members yet
                </p>
              )}

              {/* Add member */}
              {canManage && (
                <>
                  {showAddMember ? (
                    <AddMemberForm teamId={team.id} onClose={() => setShowAddMember(false)} />
                  ) : (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 mt-2"
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
    </div>
  );
}

export default function TeamManager() {
  const { isAdmin } = useAuth();
  const [showAddTeam, setShowAddTeam] = useState(false);

  const { data: teams, isLoading, error } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">Failed to load teams</div>
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
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
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
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No teams created yet</p>
          {isAdmin && (
            <button
              onClick={() => setShowAddTeam(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Create your first team
            </button>
          )}
        </div>
      )}
    </div>
  );
}
