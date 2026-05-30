import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import mediaApi from '../api/mediaApi';

export const useMediaAvailability = (date, type) => {
  return useQuery({
    queryKey: ['media', 'availability', type, date],
    queryFn: () => mediaApi.getDailyAvailability(date, type),
    enabled: !!date && !!type,
    staleTime: 0,
  });
};

export const useMyMediaBookings = () => {
  return useQuery({
    queryKey: ['media', 'bookings', 'mine'],
    queryFn: () => mediaApi.getMyBookings(),
    staleTime: 0,
  });
};

export const useCreateMediaBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mediaApi.createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'media'] });
    },
  });
};

export const useUpdateMediaBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => mediaApi.updateBooking(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'media'] });
    },
  });
};

export const useCancelMediaBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mediaApi.deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['media', 'availability'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'media'] });
    },
  });
};
