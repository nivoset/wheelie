import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
}

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

const fetchUser = async (): Promise<User> => {
  const response = await fetch('/api/user', {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
};

const fetchSchedules = async (): Promise<WorkSchedule[]> => {
  const response = await fetch('/api/schedules', {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error('Failed to fetch schedules');
  }
  return response.json();
};

const fetchCarpools = async (): Promise<CarpoolMember[]> => {
  const response = await fetch('/api/carpools', {
    credentials: 'include'
  });
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