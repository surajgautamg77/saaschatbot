import React, { useState } from 'react';
import { apiClient } from '../api/apiClient';
import { ConfirmationModal } from './ConfirmationModal';

interface Props {
    memberId: string;
    email: string;
    initialRole: 'AGENT' | 'MANAGER';
    onRoleChange: (memberId: string, newRole: 'AGENT' | 'MANAGER') => void;
}

export const RoleManagement: React.FC<Props> = ({ memberId, email, initialRole, onRoleChange }) => {
    const [role, setRole] = useState(initialRole);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRole, setNewRole] = useState<'AGENT' | 'MANAGER'>(initialRole);

    const handleDropdownChange = (selectedRole: 'AGENT' | 'MANAGER') => {
        if (selectedRole === role) return;
        setNewRole(selectedRole);
        setIsModalOpen(true);
    };

    const handleConfirm = async () => {
        setIsModalOpen(false);
        setIsLoading(true);
        try {
            await apiClient.put(`/team/${memberId}/role`, { role: newRole });
            onRoleChange(memberId, newRole);
            setRole(newRole);
        } catch (error) {
            console.error('Failed to update role', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    return (
        <>
                    <div className="flex items-center gap-2">
                        <select
                            value={role}
                            onChange={(e) => handleDropdownChange(e.target.value as 'AGENT' | 'MANAGER')}
                            className="p-1 bg-gray-700 rounded-md text-white"
                            disabled={isLoading}
                        >
                            <option value="AGENT">Agent</option>
                            <option value="MANAGER">Manager</option>
                        </select>
                    </div>
                    <ConfirmationModal
                        isOpen={isModalOpen}
                        title="Change User Role"
                        message={
                            <span>
                                Are you sure you want to change the role for <span className="text-yellow-400">{email}</span> from <span className="font-bold">{role}</span> to <span className="font-bold">{newRole}</span>?
                            </span>
                        }
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                    />
                </>
            );};