import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import approvalService from '../api/approvalService';

export const useApprovals = (domain, status = 'PENDING') => {
  return useQuery({
    queryKey: ['approvals', domain, status],
    queryFn: () => approvalService.getApprovals({ domain, status }),
    enabled: !!domain,
    staleTime: 0,
  });
};

export const useFacultyPending = () => {
  return useQuery({
    queryKey: ['approvals', 'faculty', 'pending'],
    queryFn: () => approvalService.fetchFacultyPending(),
    staleTime: 0,
  });
};

export const useInchargeEscalated = () => {
  return useQuery({
    queryKey: ['approvals', 'faculty', 'escalated'],
    queryFn: () => approvalService.fetchInchargeEscalated(),
    staleTime: 0,
  });
};

export const useResolveApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approvalService.resolveBooking,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approvals', variables.module] });
      queryClient.invalidateQueries({ queryKey: [variables.module, 'bookings', 'mine'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'bookings', 'mine'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['media', 'bookings', 'mine'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['fleet', 'bookings', 'mine'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['mess', 'bookings', 'mine'], refetchType: 'all' });
      if (variables.module === 'spaces') {
          queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      }
    },
  });
};

export const useResolveFacultyApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approvalService.resolveFacultyBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'faculty', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'bookings', 'mine'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['media', 'bookings', 'mine'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['fleet', 'bookings', 'mine'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['mess', 'bookings', 'mine'], refetchType: 'all' });
    },
  });
};

export const useResendFacultyApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approvalService.resendFacultyBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'faculty', 'escalated'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'bookings', 'mine'] });
    },
  });
};
