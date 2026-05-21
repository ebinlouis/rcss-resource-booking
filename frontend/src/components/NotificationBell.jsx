import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react';

import notificationService from '../api/notificationService';
import { useAuth } from '../hooks/useAuth';
import { getNotificationDestination } from '../utils/notificationNavigation';

const POLL_INTERVAL_MS = 30000;

const formatNotificationTime = (value) => {
    if (!value) return '';

    const createdAt = new Date(value);
    const diffMinutes = Math.max(0, Math.round((Date.now() - createdAt.getTime()) / 60000));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return createdAt.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
    });
};

const getCategoryTextColor = (category) => {
    if (!category) return 'text-gray-500';
    if (category.includes('APPROVED') || category.includes('ACCEPTED') || category.includes('GRANTED')) {
        return 'text-green-600';
    }
    if (category.includes('REJECTED') || category.includes('DECLINED')) {
        return 'text-red-600';
    }
    if (category.includes('CANCELLED') || category.includes('EXPIRED')) {
        return 'text-slate-500';
    }
    return 'text-blue-600';
};

const NotificationBell = ({ className = '', tone = 'user' }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const rootRef = useRef(null);

    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [error, setError] = useState('');

    const shellClasses = tone === 'admin'
        ? 'hover:bg-[#f0fdf4] text-[#4a6b58] hover:text-[#15803d]'
        : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800';

    const badgeClasses = tone === 'admin'
        ? 'bg-[#22c55e]'
        : 'bg-red-500';

    const loadUnreadCount = useCallback(async () => {
        if (!user) return;
        try {
            const count = await notificationService.getUnreadCount();
            setUnreadCount(count);
        } catch {
            setUnreadCount(0);
        }
    }, [user]);

    const loadNotifications = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setError('');

        try {
            const data = await notificationService.getNotifications({ page_size: 10 });
            setNotifications(data.results ?? []);
            setUnreadCount(data.unread_count ?? 0);
        } catch {
            setError('Could not load notifications.');
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            const resetTimer = window.setTimeout(() => {
                setUnreadCount(0);
                setNotifications([]);
            }, 0);
            return () => window.clearTimeout(resetTimer);
        }

        const initialTimer = window.setTimeout(loadUnreadCount, 0);
        const interval = window.setInterval(loadUnreadCount, POLL_INTERVAL_MS);

        return () => {
            window.clearTimeout(initialTimer);
            window.clearInterval(interval);
        };
    }, [loadUnreadCount, user]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handler = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const handleToggle = async (event) => {
        event.stopPropagation();
        const nextOpen = !isOpen;
        setIsOpen(nextOpen);
        if (nextOpen) {
            await loadNotifications();
        }
    };

    const handleNotificationClick = async (notification) => {
        if (!notification.is_read) {
            try {
                const updated = await notificationService.markRead(notification.id);
                setNotifications((current) =>
                    current.map((item) => (item.id === notification.id ? updated : item))
                );
                setUnreadCount((count) => Math.max(0, count - 1));
            } catch {
                return;
            }
        }

        setIsOpen(false);
        const destination = getNotificationDestination(notification);
        if (destination) {
            navigate(destination);
        }
    };

    const handleMarkAllRead = async (event) => {
        event.stopPropagation();
        if (!unreadCount || isMarkingAll) return;

        setIsMarkingAll(true);
        try {
            await notificationService.markAllRead();
            setNotifications((current) =>
                current.map((item) => ({
                    ...item,
                    is_read: true,
                    read_at: item.read_at ?? new Date().toISOString(),
                }))
            );
            setUnreadCount(0);
        } finally {
            setIsMarkingAll(false);
        }
    };

    return (
        <div className={`relative ${className}`} ref={rootRef}>
            <button
                type="button"
                onClick={handleToggle}
                className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 ${shellClasses}`}
                aria-label="Notifications"
                aria-expanded={isOpen}
            >
                <Bell className="w-[21px] h-[21px]" />
                {unreadCount > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full ${badgeClasses} text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white`}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2.5 w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl ring-1 ring-emerald-900/5 z-[70]">
                    <div className="flex items-center justify-between gap-3 border-b border-gray-100/80 bg-white/85 px-4 py-3">
                        <div>
                            <p className="text-[15px] font-bold text-gray-900 leading-tight">Notifications</p>
                            <p className="text-[13px] text-gray-500 mt-0.5">{unreadCount} unread</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            disabled={!unreadCount || isMarkingAll}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-green-700 transition hover:bg-green-50 disabled:text-gray-300 disabled:hover:bg-transparent"
                        >
                            {isMarkingAll ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <CheckCheck className="w-3.5 h-3.5" />
                            )}
                            Mark all
                        </button>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto">
                        {isLoading ? (
                            <div className="py-10 flex flex-col items-center justify-center text-gray-500">
                                <Loader2 className="w-5 h-5 animate-spin mb-2" />
                                <p className="text-[14px] font-medium">Loading notifications</p>
                            </div>
                        ) : error ? (
                            <div className="py-9 px-5 text-center">
                                <p className="text-[14px] font-semibold text-red-600">{error}</p>
                                <button
                                    type="button"
                                    onClick={loadNotifications}
                                    className="mt-3 text-[13px] font-semibold text-green-700 hover:text-green-800"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-10 px-5 text-center">
                                <Inbox className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                                <p className="text-[15px] font-semibold text-gray-700">No notifications</p>
                                <p className="text-[13px] text-gray-400 mt-1">Updates about your bookings will appear here.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100/80">
                                {notifications.map((notification) => (
                                    <button
                                        key={notification.id}
                                        type="button"
                                        onClick={() => handleNotificationClick(notification)}
                                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-green-50/70"
                                    >
                                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notification.is_read ? 'bg-gray-200' : 'bg-green-500'}`} />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center justify-between gap-3">
                                                <span className="text-[14px] font-bold text-gray-900 truncate">
                                                    {notification.title}
                                                </span>
                                                <span className="text-[11px] font-medium text-gray-400 shrink-0">
                                                    {formatNotificationTime(notification.created_at)}
                                                </span>
                                            </span>
                                            <span className="block text-[13px] text-gray-700 mt-1 leading-relaxed line-clamp-2">
                                                {notification.message}
                                            </span>
                                            <span className={`block text-[12px] font-bold mt-2 ${getCategoryTextColor(notification.category)}`}>
                                                {notification.category_display || notification.category}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="border-t border-gray-100/80 bg-white/85 px-4 py-3">
                        <Link
                            to="/notifications"
                            onClick={() => setIsOpen(false)}
                            className="block w-full text-center text-[13px] font-bold text-green-700 hover:text-green-800"
                        >
                            View notification history
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
