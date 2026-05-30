import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import spaceApi from '../api/spaceApi';
import api from '../api/axios';
import spaceAdminService from '../api/spaceAdminService';

export const useSpaceCatalog = () => {
  return useQuery({
    queryKey: ['spaces', 'catalog'],
    queryFn: () => spaceApi.getSpaces(),
  });
};

export const useMySpaceBookings = () => {
  return useQuery({
    queryKey: ['spaces', 'bookings', 'mine'],
    queryFn: () => spaceApi.getMyBookings(),
    staleTime: 0,
  });
};

export const useCreateSpaceBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: spaceApi.createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'spaces'] });
      // Only invalidate catalog if availability actually changed, but for now we'll do it safely
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
    },
  });
};

export const useUpdateSpaceBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: spaceApi.updateBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'spaces'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
    },
  });
};

export const useCancelSpaceBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: spaceApi.cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'spaces'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'spaces', 'queue'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
    },
  });
};

export const useAdminSpacesCatalog = () => {
  return useQuery({
    queryKey: ['spaces', 'catalog', 'manage'],
    queryFn: () => api.get('/spaces/catalog/?manage=true').then(res => res.data),
  });
};

export const useAdminBlocks = () => {
  return useQuery({
    queryKey: ['spaces', 'blocks'],
    queryFn: () => spaceAdminService.getBlocks(),
  });
};

export const useCreateTimetableBatch = (spaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fd) => {
      const res = await api.post(`/spaces/catalog/${spaceId}/timetable/`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'availability'] });
      window.dispatchEvent(new CustomEvent('timetable-updated'));
    }
  });
};

export const useDeleteTimetableBatch = (spaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId) => api.delete(`/spaces/catalog/${spaceId}/timetable/${batchId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'availability'] });
      window.dispatchEvent(new CustomEvent('timetable-updated'));
    }
  });
};

export const useUpdateTimetableBatch = (spaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, fd }) => api.patch(`/spaces/catalog/${spaceId}/timetable/${batchId}/`, fd, {
      headers: { "Content-Type": "multipart/form-data" }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'availability'] });
      window.dispatchEvent(new CustomEvent('timetable-updated'));
    }
  });
};

export const useEditTimetableBlock = (spaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blockId, data }) => api.patch(`/spaces/catalog/${spaceId}/timetable/blocks/${blockId}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'availability'] });
      window.dispatchEvent(new CustomEvent('timetable-updated'));
    }
  });
};

export const useClearTimetableDate = (spaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deleteDate) => api.delete(`/spaces/catalog/${spaceId}/timetable/blocks/?date=${deleteDate}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'availability'] });
      window.dispatchEvent(new CustomEvent('timetable-updated'));
    }
  });
};

export const useDeleteTimetableBlock = (spaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockId) => api.delete(`/spaces/catalog/${spaceId}/timetable/blocks/${blockId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'availability'] });
      window.dispatchEvent(new CustomEvent('timetable-updated'));
    }
  });
};

export const useCreateSpace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fd) => {
      const res = await api.post('/spaces/catalog/', fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'blocks'] });
    }
  });
};

export const useUpdateSpace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fd }) => {
      const res = await api.patch(`/spaces/catalog/${id}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'blocks'] });
    }
  });
};
