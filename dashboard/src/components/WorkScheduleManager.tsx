import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface WorkLocation {
  id: number;
  name: string;
  address: string;
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

export function WorkScheduleManager() {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<WorkSchedule[]>({
    queryKey: ['schedules'],
    queryFn: async () => {
      const response = await fetch('/api/schedules');
      if (!response.ok) {
        throw new Error('Failed to fetch schedules');
      }
      return response.json();
    }
  });

  const { data: locations, isLoading: isLoadingLocations } = useQuery<WorkLocation[]>({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await fetch('/api/offices');
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      return response.json();
    }
  });

  const addScheduleMutation = useMutation({
    mutationFn: async (newSchedule: {
      workLocationId: number;
      startTime: string;
      endTime: string;
      daysOfWeek: string;
    }) => {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSchedule),
      });

      if (!response.ok) {
        throw new Error('Failed to add schedule');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsAdding(false);
      setSelectedLocation('');
      setStartTime('');
      setEndTime('');
      setSelectedDays([]);
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete schedule');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const handleAddSchedule = () => {
    if (!selectedLocation || !startTime || !endTime || selectedDays.length === 0) {
      return;
    }

    const location = locations?.find(loc => loc.name === selectedLocation);
    if (!location) return;

    addScheduleMutation.mutate({
      workLocationId: location.id,
      startTime,
      endTime,
      daysOfWeek: selectedDays.join(','),
    });
  };

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const formatDays = (daysString: string) => {
    const days = daysString.split(',');
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(d => dayNames[parseInt(d) - 1]).join(', ');
  };

  if (isLoadingSchedules || isLoadingLocations) {
    return <div>Loading...</div>;
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Work Schedule</h2>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button variant="outline">Add Schedule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Work Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="location">Work Location</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map(location => (
                      <SelectItem key={location.id} value={location.name}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2">
                  {['1', '2', '3', '4', '5', '6', '7'].map((day) => (
                    <Button
                      key={day}
                      variant={selectedDays.includes(day) ? 'default' : 'outline'}
                      onClick={() => handleDayToggle(day)}
                      className="w-12"
                    >
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][parseInt(day) - 1]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddSchedule}
                  disabled={addScheduleMutation.isPending}
                >
                  {addScheduleMutation.isPending ? 'Adding...' : 'Add Schedule'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {schedules?.map((schedule) => (
          <div
            key={schedule.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <h3 className="font-medium">{schedule.WorkLocation.name}</h3>
              <p className="text-sm text-gray-500">
                {schedule.startTime} - {schedule.endTime}
              </p>
              <p className="text-sm text-gray-500">
                {formatDays(schedule.daysOfWeek)}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteScheduleMutation.mutate(schedule.id)}
              disabled={deleteScheduleMutation.isPending}
            >
              Delete
            </Button>
          </div>
        ))}

        {schedules?.length === 0 && (
          <div className="text-center text-gray-500">
            No schedules added yet. Click "Add Schedule" to create one.
          </div>
        )}
      </div>
    </div>
  );
} 