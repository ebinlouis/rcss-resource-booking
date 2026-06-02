import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import approvalService from '../api/approvalService';
import { useAuth } from './useAuth';

const POLL_INTERVAL_MS = 60_000; // 60 seconds
const QUERY_KEY = ['approvals', 'faculty', 'pending'];

/**
 * Tracks the number of pending faculty approval requests.
 *
 * Rules:
 *  - Count increases when the API returns more pending items.
 *  - Count decreases ONLY when faculty approves or rejects (resolved via
 *    useResolveFacultyApproval mutation which invalidates the query).
 *  - Count does NOT reset on page refresh, tab click, or drawer open.
 *  - `animate` flips true briefly when the count increases, so callers can
 *    trigger a shake/bounce animation.
 */
export function useFacultyApprovalBadge() {
  const { effectiveRoles, user } = useAuth();
  const queryClient = useQueryClient();
  const isFaculty = effectiveRoles.includes('FACULTY') &&
    !!user?.capabilities?.can_approve_faculty;

  const [pendingCount, setPendingCount] = useState(0);
  const [animate, setAnimate] = useState(false);
  const prevCountRef = useRef(0);
  const intervalRef = useRef(null);

  const fetchCount = async () => {
    if (!isFaculty) return;
    try {
      const data = await approvalService.fetchFacultyPending();
      const count = (data?.pending ?? []).length;

      // Update React Query cache so the FacultyApprovalPage stays in sync
      queryClient.setQueryData(QUERY_KEY, (old) =>
        old ? { ...old, pending: data?.pending ?? [] } : data
      );

      setPendingCount((prev) => {
        if (count > prev) {
          // New requests arrived – trigger animation
          setAnimate(true);
          setTimeout(() => setAnimate(false), 1200);
        }
        prevCountRef.current = count;
        return count;
      });
    } catch {
      // Silently ignore – badge will just stay at last known value
    }
  };

  useEffect(() => {
    if (!isFaculty) {
      setPendingCount(0);
      return;
    }

    // Immediately try to get count from existing React Query cache first
    const cached = queryClient.getQueryData(QUERY_KEY);
    if (cached?.pending) {
      const cachedCount = cached.pending.length;
      setPendingCount(cachedCount);
      prevCountRef.current = cachedCount;
    }

    // Then fetch fresh data
    fetchCount();

    // Poll periodically
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFaculty]);

  // Subscribe to React Query cache invalidations triggered by resolve mutations.
  // When the mutation succeeds it calls invalidateQueries(['approvals','faculty','pending']),
  // which causes a refetch — we intercept that refetch result here.
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event?.type === 'updated' &&
        JSON.stringify(event.query.queryKey) === JSON.stringify(QUERY_KEY)
      ) {
        const fresh = event.query.state.data;
        if (fresh?.pending) {
          const count = fresh.pending.length;
          setPendingCount((prev) => {
            if (count > prev) {
              setAnimate(true);
              setTimeout(() => setAnimate(false), 1200);
            }
            prevCountRef.current = count;
            return count;
          });
        }
      }
    });

    return unsubscribe;
  }, [queryClient]);

  return { pendingCount, animate, isFaculty };
}
