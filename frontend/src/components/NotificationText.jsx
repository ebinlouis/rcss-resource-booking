const STATUS_STYLES = {
    approved: 'font-bold text-green-700',
    rejected: 'font-bold text-red-600',
    cancelled: 'font-bold text-slate-700',
};

const STATUS_PATTERN = /(\bapproved\b|\brejected\b|\bcancelled\b)/i;

const NotificationText = ({ children, className = '' }) => {
    const text = String(children ?? '');
    const parts = text.split(STATUS_PATTERN);

    return (
        <span className={className}>
            {parts.map((part, index) => {
                const key = part.toLowerCase();
                if (STATUS_STYLES[key]) {
                    return (
                        <span key={`${part}-${index}`} className={STATUS_STYLES[key]}>
                            {part}
                        </span>
                    );
                }
                return part;
            })}
        </span>
    );
};

export default NotificationText;
