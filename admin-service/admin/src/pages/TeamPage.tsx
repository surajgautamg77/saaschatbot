import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/apiClient';
import { UserIcon } from '../components/Icons'; // Assuming you have a user icon
import { useAuthStore } from '../store/authStore';
import { RoleManagement } from '../components/RoleManagement';

interface TeamMember {
    id: string;
    email: string;
    role: 'OWNER' | 'AGENT' | 'MANAGER';
    createdAt: string;
}

interface PendingInvitation {
    id: string;
    email: string;
    expiresAt: string;
}

export const TeamPage: React.FC = () => {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'AGENT' | 'MANAGER'>('AGENT');
    const [inviteStatus, setInviteStatus] = useState<{ message: string; isError: boolean } | null>(null);
    const [addEmail, setAddEmail] = useState('');
    const [addRole, setAddRole] = useState<'AGENT' | 'MANAGER'>('AGENT');
    const [addStatus, setAddStatus] = useState<{ message: string; isError: boolean } | null>(null);
    const currentUser = useAuthStore((state) => state.user);

     const inputClass =
        "w-full p-3 bg-gray-800 rounded-lg ring-1 ring-white/10 " +
        "focus:outline-none focus:ring-2 focus:ring-white/40 " +
        "placeholder-gray-400 pr-12";

    useEffect(() => {
        if (inviteStatus) {
            const timer = setTimeout(() => setInviteStatus(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [inviteStatus]);

    useEffect(() => {
        if (addStatus) {
            const timer = setTimeout(() => setAddStatus(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [addStatus]);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [membersData, invitationsData] = await Promise.all([
                apiClient.get<TeamMember[]>('/team'),
                apiClient.get<PendingInvitation[]>('/team/invitations')
            ]);
            setMembers(membersData);
            setInvitations(invitationsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load team data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        try {
            const response = await apiClient.post<{ message: string }>('/team/invite', { email: inviteEmail, role: inviteRole });
            setInviteStatus({ message: response.message, isError: false });
            setInviteEmail('');
            fetchData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setInviteStatus({ message: errorMessage, isError: true });
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addEmail) return;
        try {
            const response = await apiClient.post<TeamMember>('/team/add-member', { email: addEmail, role: addRole });
            setAddStatus({ message: `Member ${response.email} added successfully.`, isError: false });
            setAddEmail('');
            fetchData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setAddStatus({ message: errorMessage, isError: true });
        }
    };

    const handleRemove = async (memberId: string) => {
        if (!window.confirm('Are you sure you want to remove this team member?')) return;
        try {
            await apiClient.delete(`/team/${memberId}`);
            fetchData();
        } catch (err) {
            alert(`Failed to remove member: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`);
        }
    };

    const handleRevoke = async (invitationId: string) => {
        if (!window.confirm('Are you sure you want to revoke this invitation?')) return;
        try {
            await apiClient.delete(`/team/invitations/${invitationId}`);
            fetchData();
        } catch (err) {
            alert(`Failed to revoke invitation: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const handleRoleChange = (memberId: string, newRole: 'AGENT' | 'MANAGER') => {
        setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    };

    return (
        <div className="space-y-8">
            <div className="bg-gray-900 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Invite New Team Member</h2>
                <form onSubmit={handleInvite} className="space-y-4">
                    <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="member@example.com"
                        required
                        className={inputClass}
                    />
                    <div className='flex justify-between'>
                        <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'AGENT' | 'MANAGER')}
                        className="p-3 bg-gray-800 rounded-lg min-w-[200px] ring-1 ring-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
                    >
                        <option value="AGENT">Agent</option>
                        {currentUser?.role === 'OWNER' && <option value="MANAGER">Manager</option>}
                    </select>
                    <button type="submit" className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 min-w-[200px]">
                        Send Invitation
                    </button>
                    </div>
                </form>
                {inviteStatus && (
                    <div className={`transition-opacity duration-500 ease-in-out ${inviteStatus ? 'opacity-100' : 'opacity-0 h-0'}`}>
                        <p className={`mt-3 text-sm ${inviteStatus.isError ? 'text-red-400' : 'text-blue-400'}`}>
                            {inviteStatus.message}
                        </p>
                    </div>
                )}
            </div>

            <div className="bg-gray-900 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Add New Member Manually</h2>
                <form onSubmit={handleAddMember} className="space-y-4">
                    <input
                        type="email"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        placeholder="member@example.com"
                        required
                        className={inputClass}
                    />
                   <div className='flex justify-between'>
                     <select
                        value={addRole}
                        onChange={(e) => setAddRole(e.target.value as 'AGENT' | 'MANAGER')}
                        className="p-3 bg-gray-800 rounded-lg min-w-[200px] ring-1 ring-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
                    >
                        <option value="AGENT">Agent</option>
                        {currentUser?.role === 'OWNER' && <option value="MANAGER">Manager</option>}
                    </select>
                    <button type="submit" className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 min-w-[200px]">
                        Add Member
                    </button>
                   </div>
                </form>
                {addStatus && (
                     <div className={`transition-opacity duration-500 ease-in-out ${addStatus ? 'opacity-100' : 'opacity-0 h-0'}`}>
                        <p className={`mt-3 text-sm ${addStatus.isError ? 'text-red-400' : 'text-blue-400'}`}>
                            {addStatus.message}
                        </p>
                    </div>
                )}
                <p className="mt-2 text-sm text-gray-400">The member will be created with the default password "12345678".</p>
            </div>

            {invitations.length > 0 && (
                <div className="bg-gray-900 rounded-xl shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Pending Invitations ({invitations.length})</h2>
                    <div className="space-y-3">
                        {invitations.map(invite => (
                            <div key={invite.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                <div className="flex items-center gap-4">
                                    <UserIcon className="w-8 h-8 text-blue-400" />
                                    <div>
                                        <p className="font-semibold text-gray-200">{invite.email}</p>
                                        <p className="text-sm text-gray-400">Expires in {Math.round((new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60))} hours</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRevoke(invite.id)}
                                    className="px-4 py-2 bg-red-900/30 text-red-400 border border-red-900/50 rounded-lg text-sm font-semibold hover:bg-red-900/50 hover:text-red-300 transition-colors"
                                >
                                    Revoke
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-gray-900 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Team Members ({members.length})</h2>
                {isLoading && <p className="text-gray-400">Loading members...</p>}
                {error && <p className="text-red-400">{error}</p>}
                <div className="space-y-3">
                    {members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                            <div className="flex items-center gap-4">
                                <UserIcon className="w-8 h-8 text-gray-400" />
                                <div>
                                    <p className="font-semibold text-gray-200">
                                        {member.email} 
                                        
                                        
                                    </p>
                                    <p className="text-sm text-gray-400">Joined on {new Date(member.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {member.role === 'OWNER' && (
                                            <span className="px-2 py-1 ml-2 text-xs font-bold rounded bg-blue-600 text-white">
                                                OWNER
                                            </span>
                                        )}
                                {currentUser?.role === 'OWNER' && member.id !== currentUser?.id && (member.role === 'AGENT' || member.role === 'MANAGER') && (
                                    <RoleManagement memberId={member.id} email={member.email} initialRole={member.role} onRoleChange={handleRoleChange} />
                                )}
                                {member.id !== currentUser?.id && (
                                    (currentUser?.role === 'OWNER' && (member.role === 'AGENT' || member.role === 'MANAGER')) ||
                                    (currentUser?.role === 'MANAGER' && member.role === 'AGENT')
                                ) && (
                                    <button
                                        onClick={() => handleRemove(member.id)}
                                        className="px-4 py-1 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};