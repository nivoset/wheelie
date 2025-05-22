import { useQuery } from '@tanstack/react-query';

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

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

const fetchUser = async (): Promise<User> => {
  const response = await fetch('http://localhost:3001/api/user', {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
};

const fetchSchedules = async (): Promise<WorkSchedule[]> => {
  const response = await fetch('/api/schedules');
  if (!response.ok) {
    throw new Error('Failed to fetch schedules');
  }
  return response.json();
};

const fetchCarpools = async (): Promise<CarpoolMember[]> => {
  const response = await fetch('/api/carpools');
  if (!response.ok) {
    throw new Error('Failed to fetch carpools');
  }
  return response.json();
};

export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: fetchUser,
  });
}

export function useSchedules() {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: fetchSchedules,
  });
}

export function useCarpools() {
  return useQuery({
    queryKey: ['carpools'],
    queryFn: fetchCarpools,
  });
} 