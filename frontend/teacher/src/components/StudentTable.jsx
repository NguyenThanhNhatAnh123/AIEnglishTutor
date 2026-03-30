import { useState, useEffect } from 'react';
import { studentApi } from '../services/api';

export default function StudentTable({ classId }) {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    studentApi.getAll()
      .then((r) => setStudents(r.data?.data || []))
      .catch(() => setStudents([]));
  }, []);

  if (students.length === 0) return null;

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="py-2">Student Code</th>
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
          </tr>
        </thead>
        <tbody>
          {students.slice(0, 5).map((s) => (
            <tr key={s.id} className="text-slate-300 border-t border-slate-700">
              <td className="py-2">{s.studentCode}</td>
              <td className="py-2">{s.fullName}</td>
              <td className="py-2">{s.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
