import { useEffect, useState } from 'react';
import { emitRoleChange, getCurrentRole } from '../utils/auth';
import CustomSelect from './CustomSelect';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'data-entry', label: 'Data Entry' },
  { value: 'viewer', label: 'Viewer' },
];

function RoleSwitcher() {
  const [role, setRole] = useState(getCurrentRole());

  useEffect(() => {
    emitRoleChange(role);
  }, [role]);

  return (
    <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role</span>
      <CustomSelect
        className="min-w-[150px]"
        buttonClassName="h-8 border-0 bg-transparent p-0 text-sm font-semibold text-slate-700 focus:ring-0"
        menuClassName="right-0 left-auto min-w-[160px]"
        value={role}
        onChange={setRole}
        options={ROLE_OPTIONS}
      />
    </label>
  );
}

export default RoleSwitcher;
