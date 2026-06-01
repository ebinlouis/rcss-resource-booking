import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as fleetApi from '../api/fleetApi';
import { getVehicles, getMyBookings, getAllBookings, getPendingBookings, getResolvedByMe, getActiveBookings } from '../api/fleetApi';

export const useVehicles = () => {
  return useQuery({
    queryKey: ['fleet', 'vehicles'],
    queryFn: () => getVehicles(),
  });
};

export const useMyFleetBookings = (params = {}) => {
  return useQuery({
    queryKey: ['fleet', 'bookings', 'mine'],
    queryFn: () => getMyBookings(params),
    staleTime: 0,
    refetchOnMount: 'always',
  });
};

export const useAllFleetBookings = (params = {}) => {
  return useQuery({
    queryKey: ['fleet', 'bookings', 'general', params],
    queryFn: () => getAllBookings(params),
    staleTime: 0,
  });
};

export const usePendingFleetBookings = (params = {}) => {
  return useQuery({
    queryKey: ['fleet', 'bookings', 'pending', params],
    queryFn: () => getPendingBookings(params),
    staleTime: 0,
  });
};

export const useResolvedByMeFleetBookings = (params = {}) => {
  return useQuery({
    queryKey: ['approvals', 'fleet', 'resolved_by_me', params],
    queryFn: () => getResolvedByMe(params),
  });
};

export const useActiveFleetBookings = (params = {}) => {
  return useQuery({
    queryKey: ['fleet', 'bookings', 'active', params],
    queryFn: () => getActiveBookings(params),
    staleTime: 0,
  });
};

export const useCreateFleetBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fleetApi.createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'fleet'] });
    },
  });
};

export const useUpdateFleetBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => fleetApi.updateBooking(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'fleet'] });
    },
  });
};

export const useCancelFleetBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fleetApi.cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'fleet'] });
    },
  });
};
