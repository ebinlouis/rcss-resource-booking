import { useQuery } from '@tanstack/react-query';
import notificationService from '../api/notificationService';

export const useNotifications = (params = {}) => {
  return useQuery({
    queryKey: ['notifications', 'all', params],
    queryFn: () => notificationService.getNotifications(params),
    staleTime: 0,
  });
};
