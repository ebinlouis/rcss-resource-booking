import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react';

import MainLayout from '../layouts/MainLayout';
import notificationService from '../api/notificationService';
import { getNotificationDestination } from '../utils/notificationNavigation';

const PAGE_SIZE = 20;

const formatDateTime = (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(new Date(value));
};

const getCategoryBadgeStyle = (category) => {
    if (!category) return 'bg-gray-100 text-gray-600';
    if (category.includes('APPROVED') || category.includes('ACCEPTED') || category.includes('GRANTED')) {
        return 'bg-green-100 text-green-800';
    }
    if (category.includes('REJECTED') || category.includes('DECLINED')) {
        return 'bg-red-100 text-red-800';
    }
    if (category.includes('CANCELLED') || category.includes('EXPIRED')) {
        return 'bg-slate-100 text-slate-700';
    }
    return 'bg-blue-50 text-blue-700'; 
};

const NotificationsPage = () => {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [data, setData] = useState({
        unread_count: 0,
        count: 0,
        next: null,
        previous: null,
        results: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const [error, setError] = useState('');

    const loadNotifications = useCallback(async () => {
        setIsLoading(true);
        setError('');

        try {
            const response = await notificationService.getNotifications({
                page,
                page_size: PAGE_SIZE,
            });
            setData(response);
        } catch {
            setError('Could not load your notification history.');
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    useEffect(() => {
        const timer = window.setTimeout(loadNotifications, 0);
        return () => window.clearTimeout(timer);
    }, [loadNotifications]);

    const visibleNotifications = useMemo(() => {
        if (activeFilter === 'UNREAD') {
            return data.results.filter((notification) => !notification.is_read);
        }
        return data.results;
    }, [activeFilter, data.results]);

    const handleNotificationClick = async (notification) => {
        if (!notification.is_read) {
            try {
                const updated = await notificationService.markRead(notification.id);
                setData((current) => ({
                    ...current,
                    unread_count: Math.max(0, current.unread_count - 1),
                    results: current.results.map((item) =>
                        item.id === notification.id ? updated : item
                    ),
                }));
            } catch {
                return;
            }
        }

        const destination = getNotificationDestination(notification);
        if (destination) {
            navigate(destination);
        }
    };

    const handleMarkAllRead = async () => {
        if (!data.unread_count || isMarkingAll) return;

        setIsMarkingAll(true);
        try {
            await notificationService.markAllRead();
            setData((current) => ({
                ...current,
                unread_count: 0,
                results: current.results.map((notification) => ({
                    ...notification,
                    is_read: true,
                    read_at: notification.read_at ?? new Date().toISOString(),
                })),
            }));
        } finally {
            setIsMarkingAll(false);
        }
    };

    return (
        <MainLayout>
            <div className="max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-100 text-green-700 text-[13px] font-bold mb-4">
                            <Bell className="w-4 h-4" />
                            {data.unread_count} unread
                        </div>
                        <h1 className="text-[34px] font-bold tracking-tight text-gray-900 leading-tight">
                            Notification History
                        </h1>
                        <p className="text-[15px] text-gray-600 mt-2 max-w-2xl">
                            Review booking updates, approvals, rejections, cancellations, and system messages.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleMarkAllRead}
                        disabled={!data.unread_count || isMarkingAll}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-green-600 text-white text-[14px] font-bold shadow-sm hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 transition"
                    >
                        {isMarkingAll ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCheck className="w-4 h-4" />
                        )}
                        Mark all read
                    </button>
                </div>

                <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-xl shadow-emerald-950/5 backdrop-blur-xl ring-1 ring-emerald-900/5">
                    <div className="flex items-center justify-between gap-3 border-b border-gray-100/80 bg-white/85 px-5 py-4">
                        <div className="flex items-center gap-2">
                            {[
                                ['ALL', 'All'],
                                ['UNREAD', 'Unread'],
                            ].map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setActiveFilter(value)}
                                    className={`px-4 py-2 rounded-xl text-[13px] font-bold transition ${
                                        activeFilter === value
                                            ? 'bg-green-600 text-white shadow-sm'
                                            : 'border border-gray-200/80 bg-white/90 text-gray-600 hover:bg-white'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <span className="hidden sm:block text-[13px] text-gray-500 font-medium">
                            {data.count} total
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="py-24 flex flex-col items-center justify-center text-gray-500">
                            <Loader2 className="w-7 h-7 animate-spin mb-3 text-green-600" />
                            <p className="text-[15px] font-semibold">Loading notifications</p>
                        </div>
                    ) : error ? (
                        <div className="py-24 px-6 text-center">
                            <p className="text-[16px] font-bold text-red-600">{error}</p>
                            <button
                                type="button"
                                onClick={loadNotifications}
                                className="mt-4 px-5 py-2.5 rounded-xl bg-green-600 text-white text-[14px] font-bold hover:bg-green-700 transition"
                            >
                                Try again
                            </button>
                        </div>
                    ) : visibleNotifications.length === 0 ? (
                        <div className="py-24 px-6 text-center">
                            <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <h2 className="text-[20px] font-bold text-gray-900">
                                No notifications here
                            </h2>
                            <p className="text-[14px] text-gray-500 mt-1">
                                {activeFilter === 'UNREAD'
                                    ? 'Everything on this page has been read.'
                                    : 'Your notification history will appear here.'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100/80">
                            {visibleNotifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    type="button"
                                    onClick={() => handleNotificationClick(notification)}
                                    className="flex w-full gap-4 px-6 py-5 text-left transition hover:bg-green-50/60"
                                >
                                    <span className={`mt-2 w-2.5 h-2.5 rounded-full shrink-0 ${notification.is_read ? 'bg-gray-200' : 'bg-green-500'}`} />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <span className="text-[16px] font-bold text-gray-900 leading-snug">
                                                {notification.title}
                                            </span>
                                            <span className="text-[12px] text-gray-400 font-semibold shrink-0">
                                                {formatDateTime(notification.created_at)}
                                            </span>
                                        </span>
                                        <span className="block text-[14px] text-gray-700 leading-relaxed mt-2">
                                            {notification.message}
                                        </span>
                                        <span className={`inline-flex mt-3 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] ${getCategoryBadgeStyle(notification.category)}`}>
                                            {notification.category_display || notification.category}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3 border-t border-gray-100/80 bg-white/85 px-5 py-4">
                        <button
                            type="button"
                            onClick={() => setPage((value) => Math.max(1, value - 1))}
                            disabled={!data.previous || isLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                        </button>
                        <span className="text-[13px] font-bold text-gray-500">Page {page}</span>
                        <button
                            type="button"
                            onClick={() => setPage((value) => value + 1)}
                            disabled={!data.next || isLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default NotificationsPage;
