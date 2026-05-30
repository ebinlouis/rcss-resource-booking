import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

const ENDPOINT = '/spaces/equipment/';

export const useCreateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
    }
  });
};

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`${ENDPOINT}${id}/`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
    }
  });
};

export const useSoftDeleteEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`${ENDPOINT}${id}/`, { is_active: false });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
    }
  });
};
