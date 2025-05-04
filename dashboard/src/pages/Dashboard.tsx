import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface WorkSchedule {
  id: number;
  startTime: string;
  endTime: string;
  daysOfWeek: string;
  WorkLocation: {
    name: string;
    address: string;
  };
}

interface CarpoolMember {
  id: number;
  isOrganizer: boolean;
  CarpoolGroup: {
    name: string;
    WorkLocation: {
      name: string;
      address: string;
    };
  };
}

const Dashboard: React.FC = () => {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [carpools, setCarpools] = useState<CarpoolMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schedulesRes, carpoolsRes] = await Promise.all([
          axios.get('/api/schedules'),
          axios.get('/api/carpools')
        ]);
        setSchedules(schedulesRes.data);
        setCarpools(carpoolsRes.data);
      } catch (err) {
        setError('Failed to fetch data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Work Schedules */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Work Schedules</h2>
          {schedules.length === 0 ? (
            <p className="text-gray-500">No work schedules found</p>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="border rounded p-4">
                  <h3 className="font-medium">{schedule.WorkLocation.name}</h3>
                  <p className="text-gray-600">{schedule.WorkLocation.address}</p>
                  <p className="text-sm text-gray-500">
                    {schedule.daysOfWeek} • {schedule.startTime} - {schedule.endTime}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Carpool Groups */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Carpool Groups</h2>
          {carpools.length === 0 ? (
            <p className="text-gray-500">No carpool groups found</p>
          ) : (
            <div className="space-y-4">
              {carpools.map((member) => (
                <div key={member.id} className="border rounded p-4">
                  <h3 className="font-medium">{member.CarpoolGroup.name}</h3>
                  <p className="text-gray-600">{member.CarpoolGroup.WorkLocation.name}</p>
                  <p className="text-sm text-gray-500">
                    {member.isOrganizer ? 'Organizer' : 'Member'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 