import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Next.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface UserMapProps {
  userId: string;
}

export function UserMap({ userId }: UserMapProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState('');
  const [map, setMap] = useState<L.Map | null>(null);
  const [marker, setMarker] = useState<L.Marker | null>(null);
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const response = await fetch('/api/user');
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      return response.json();
    }
  });

  const updateAddressMutation = useMutation({
    mutationFn: async (newAddress: string) => {
      const response = await fetch('/api/user/address', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: newAddress }),
      });

      if (!response.ok) {
        throw new Error('Failed to update address');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      setIsEditing(false);
    },
  });

  const handleUpdateAddress = async () => {
    updateAddressMutation.mutate(address);
  };

  // Initialize map
  useEffect(() => {
    if (!map && typeof window !== 'undefined') {
      const newMap = L.map('map').setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(newMap);
      setMap(newMap);
    }

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  // Update marker when user data changes
  useEffect(() => {
    if (map && user?.homeLatitude && user?.homeLongitude) {
      if (marker) {
        marker.remove();
      }
      const newMarker = L.marker([user.homeLatitude, user.homeLongitude]).addTo(map);
      setMarker(newMarker);
      map.setView([user.homeLatitude, user.homeLongitude], 13);
    }
  }, [map, user?.homeLatitude, user?.homeLongitude]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Your Location</h2>
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogTrigger asChild>
            <Button variant="outline">Edit Address</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Your Address</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
                  placeholder="Enter your address"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateAddress}
                  disabled={updateAddressMutation.isPending}
                >
                  {updateAddressMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div id="map" className="h-[400px] w-full rounded-lg border bg-gray-100">
        {!user?.homeAddress && (
          <div className="flex h-full items-center justify-center text-gray-500">
            No address set. Click "Edit Address" to add your location.
          </div>
        )}
      </div>
    </div>
  );
} 