import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import messService from '../api/messService';

export const useMyMessBookings = () => {
  return useQuery({
    queryKey: ['mess', 'bookings', 'mine'],
    queryFn: () => messService.getMyBookings(),
    staleTime: 0,
  });
};

export const useCreateMessBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: messService.createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mess', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'mess'] });
    },
  });
};

export const useUpdateMessBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => messService.updateBooking(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mess', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'mess'] });
    },
  });
};

export const useCancelMessBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: messService.deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mess', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'mess'] });
    },
  });
};
