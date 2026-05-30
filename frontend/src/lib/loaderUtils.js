import { queryClient } from './queryClient';

export async function ensureProtectedQuery(options) {
  try {
    return await queryClient.ensureQueryData(options);
  } catch (error) {
    if (error?.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export function prefetchProtectedQuery(options) {
  queryClient.prefetchQuery(options).catch(error => {
    // Ignore 401s, ProtectedRoute handles redirect.
    // Allow other errors to be thrown or logged.
    if (error?.response?.status !== 401) {
      console.error("Prefetch error:", error);
    }
  });
  return null;
}
