import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import approvalService from '../../api/approvalService';
import { useAuth } from '../../hooks/useAuth';

// ==========================================
// STYLES  (injected once)
// ==========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');

  .adc-root {
    --c-bg:        #F7F6F3;
    --c-surface:   #FFFFFF;
    --c-border:    rgba(0,0,0,0.08);
    --c-border-md: rgba(0,0,0,0.12);
    --c-text-1:    #0F0F0F;
    --c-text-2:    #6B6B6B;
    --c-text-3:    #A8A8A8;
    --c-blue-bg:   #EBF2FF;
    --c-blue:      #1A56DB;
    --c-blue-dark: #1140AA;
    --c-green-bg:  #ECFDF5;
    --c-green:     #0D9F6E;
    --c-red-bg:    #FEF2F2;
    --c-red:       #DC2626;
    --c-amber-bg:  #FFFBEB;
    --c-amber:     #B45309;
    font-family: 'DM Sans', sans-serif;
    background: var(--c-bg);
    min-height: 100vh;
    color: var(--c-text-1);
  }

  /* ---- layout ---- */
  .adc-page   { max-width: 1100px; margin: 0 auto; padding: 2.5rem 1.5rem; }
  .adc-topbar { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:2rem; gap:1rem; flex-wrap:wrap; }
  .adc-eyebrow{ font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--c-text-3); font-weight:500; margin-bottom:4px; }
  .adc-title  { font-size:24px; font-weight:500; color:var(--c-text-1); letter-spacing:-.02em; }
  .adc-sub    { font-size:13px; color:var(--c-text-2); margin-top:3px; }

  /* ---- stat strip ---- */
  .adc-stats  { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:1.5rem; }
  .adc-stat   { background:var(--c-surface); border:1px solid var(--c-border); border-radius:12px; padding:14px 18px; }
  .adc-stat-n { font-size:26px; font-weight:300; color:var(--c-text-1); letter-spacing:-.03em; line-height:1; }
  .adc-stat-l { font-size:11px; color:var(--c-text-3); margin-top:5px; letter-spacing:.03em; }

  /* ---- queue panel ---- */
  .adc-panel  { background:var(--c-surface); border:1px solid var(--c-border); border-radius:16px; overflow:hidden; }
  .adc-phead  { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid var(--c-border); }
  .adc-phead-l{ font-size:11px; letter-spacing:.07em; text-transform:uppercase; color:var(--c-text-3); font-weight:500; }

  /* ---- booking row ---- */
  .adc-row    { padding:20px 24px; border-bottom:1px solid var(--c-border); transition:background .12s; cursor:default; }
  .adc-row:last-child{ border-bottom:none; }
  .adc-row:hover{ background:#FBFAF8; }

  .adc-row-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px; }
  .adc-row-top-left{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }

  .adc-ref    { font-family:'DM Mono',monospace; font-size:11.5px; color:var(--c-text-2); background:#F4F3F0; padding:3px 8px; border-radius:5px; border:1px solid var(--c-border); }
  .adc-pax    { display:inline-flex; align-items:center; gap:4px; font-size:12px; color:var(--c-text-2); }
  .adc-pax svg{ width:13px; height:13px; opacity:.6; }
  .adc-ts     { font-size:11px; color:var(--c-text-3); white-space:nowrap; }

  /* ---- 3-col info grid ---- */
  .adc-grid   { display:grid; grid-template-columns:1.8fr 1.6fr 2.6fr; gap:24px; }
  .adc-col-lbl{ font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--c-text-3); font-weight:500; margin-bottom:8px; }

  .adc-resource{ display:flex; align-items:flex-start; gap:12px; }
  .adc-ricon   { width:38px; height:38px; border-radius:10px; background:var(--c-blue-bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .adc-ricon svg{ width:18px; height:18px; color:var(--c-blue); stroke:var(--c-blue); }
  .adc-rname   { font-size:14px; font-weight:500; color:var(--c-text-1); line-height:1.3; }
  .adc-rdomain { font-size:11px; color:var(--c-text-3); margin-top:3px; }

  .adc-sched   { display:flex; flex-direction:column; gap:0; }
  .adc-srow    { display:flex; align-items:flex-start; gap:10px; }
  .adc-sline-wrap{ display:flex; flex-direction:column; align-items:center; padding-top:3px; }
  .adc-sdot    { width:7px; height:7px; border-radius:50%; flex-shrink:0; margin-top:4px; }
  .adc-sdot.s  { background:var(--c-green); }
  .adc-sdot.e  { background:var(--c-red); }
  .adc-sconnect{ width:1px; height:18px; background:var(--c-border-md); margin:3px 0; }
  .adc-slabel  { font-size:10px; color:var(--c-text-3); letter-spacing:.03em; display:block; margin-bottom:1px; }
  .adc-sval    { font-size:13px; font-weight:500; color:var(--c-text-1); }

  .adc-requester{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
  .adc-avatar  { width:30px; height:30px; border-radius:50%; background:var(--c-blue-bg); color:var(--c-blue); font-size:12px; font-weight:500; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .adc-rqname  { font-size:13px; font-weight:500; color:var(--c-text-1); }
  .adc-rqdept  { font-size:11px; color:var(--c-text-3); margin-top:1px; }
  .adc-purpose { font-size:12px; color:var(--c-text-2); background:#F7F6F3; padding:9px 11px; border-radius:8px; border:1px solid var(--c-border); line-height:1.55; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

  /* ---- equipment tags ---- */
  .adc-eq-row  { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
  .adc-eq-tag  { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:500; color:var(--c-blue); background:var(--c-blue-bg); border:1px solid rgba(26,86,219,0.15); padding:2px 8px; border-radius:99px; white-space:nowrap; }
  .adc-eq-tag svg{ width:10px; height:10px; opacity:.7; }

  /* ---- notes block ---- */
  .adc-notes   { font-size:12px; color:var(--c-text-2); background:var(--c-amber-bg); padding:8px 11px; border-radius:8px; border:1px solid rgba(180,83,9,0.15); line-height:1.55; margin-top:8px; }
  .adc-notes-lbl{ font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--c-amber); font-weight:500; margin-bottom:3px; }

  /* ---- supplemental info row below the 3-col grid ---- */
  .adc-extras  { margin-top:14px; padding-top:14px; border-top:1px solid var(--c-border); display:flex; flex-direction:column; gap:8px; }

  /* ---- actions ---- */
  .adc-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; padding-top:16px; border-top:1px solid var(--c-border); }
  .adc-btn-rej { display:inline-flex; align-items:center; gap:5px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:400; padding:7px 16px; border-radius:8px; border:1px solid var(--c-border-md); background:transparent; color:var(--c-text-2); cursor:pointer; transition:all .15s; }
  .adc-btn-rej:hover{ background:var(--c-red-bg); color:var(--c-red); border-color:rgba(220,38,38,.2); }
  .adc-btn-rej:disabled{ opacity:.45; cursor:default; }
  .adc-btn-app { display:inline-flex; align-items:center; gap:6px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; padding:7px 18px; border-radius:8px; border:none; background:var(--c-text-1); color:#fff; cursor:pointer; transition:opacity .15s; }
  .adc-btn-app:hover{ opacity:.82; }
  .adc-btn-app:disabled{ opacity:.45; cursor:default; }
  .adc-btn-app svg, .adc-btn-rej svg{ width:14px; height:14px; }

  /* ---- refresh btn ---- */
  .adc-refresh { display:inline-flex; align-items:center; gap:6px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:400; padding:8px 16px; border-radius:8px; border:1px solid var(--c-border-md); background:var(--c-surface); color:var(--c-text-2); cursor:pointer; transition:background .15s; }
  .adc-refresh:hover{ background:#F4F3F0; }
  .adc-refresh:disabled{ opacity:.45; cursor:default; }
  .adc-refresh svg{ width:14px; height:14px; }
  .adc-refresh svg.spin{ animation:adc-spin .7s linear infinite; }
  @keyframes adc-spin{ to{ transform:rotate(360deg); } }

  /* ---- empty / loading / error states ---- */
  .adc-state  { padding:4rem 2rem; text-align:center; }
  .adc-state-icon{ width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
  .adc-state-icon svg{ width:22px; height:22px; }
  .adc-state-icon.green{ background:var(--c-green-bg); color:var(--c-green); stroke:var(--c-green); }
  .adc-state-icon.red  { background:var(--c-red-bg);   color:var(--c-red);   stroke:var(--c-red); }
  .adc-state-title{ font-size:15px; font-weight:500; color:var(--c-text-1); }
  .adc-state-sub  { font-size:13px; color:var(--c-text-3); margin-top:5px; }

  /* ---- modal overlay ---- */
  .adc-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.4); backdrop-filter:blur(4px); z-index:50; display:flex; align-items:center; justify-content:center; padding:1.5rem; }
  .adc-modal  { background:var(--c-surface); border-radius:16px; border:1px solid var(--c-border-md); padding:1.75rem; width:100%; max-width:420px; }
  .adc-modal-title{ font-size:16px; font-weight:500; color:var(--c-text-1); margin-bottom:4px; letter-spacing:-.01em; }
  .adc-modal-sub  { font-size:13px; color:var(--c-text-2); margin-bottom:1.25rem; padding-bottom:1.25rem; border-bottom:1px solid var(--c-border); }
  .adc-modal-sub strong{ color:var(--c-text-1); font-weight:500; }
  .adc-modal-lbl  { font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--c-text-3); font-weight:500; margin-bottom:7px; }
  .adc-modal-ta   { width:100%; border:1px solid var(--c-border-md); border-radius:8px; padding:10px 13px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--c-text-1); background:var(--c-surface); resize:none; outline:none; min-height:88px; transition:border .15s; box-sizing:border-box; }
  .adc-modal-ta:focus{ border-color:var(--c-text-1); }
  .adc-modal-hint { font-size:11px; color:var(--c-text-3); margin-top:5px; }
  .adc-modal-acts { display:flex; gap:8px; justify-content:flex-end; margin-top:1.25rem; }
  .adc-modal-cancel{ display:inline-flex; align-items:center; font-family:'DM Sans',sans-serif; font-size:13px; padding:7px 16px; border-radius:8px; border:1px solid var(--c-border-md); background:transparent; color:var(--c-text-2); cursor:pointer; transition:background .15s; }
  .adc-modal-cancel:hover{ background:#F4F3F0; }
  .adc-modal-cancel:disabled{ opacity:.45; }
  .adc-modal-confirm{ display:inline-flex; align-items:center; gap:5px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; padding:7px 18px; border-radius:8px; border:none; background:var(--c-red); color:#fff; cursor:pointer; transition:opacity .15s; }
  .adc-modal-confirm:hover{ opacity:.85; }
  .adc-modal-confirm:disabled{ opacity:.4; cursor:default; }

  /* ---- success modal ---- */
  .adc-success-icon{ width:48px; height:48px; border-radius:50%; background:var(--c-green-bg); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; }
  .adc-success-icon svg{ width:22px; height:22px; stroke:var(--c-green); }
  .adc-success-title{ font-size:16px; font-weight:500; color:var(--c-text-1); text-align:center; letter-spacing:-.01em; }
  .adc-success-sub  { font-size:13px; color:var(--c-text-2); text-align:center; margin-top:6px; line-height:1.5; }
  .adc-success-btn  { width:100%; margin-top:1.25rem; padding:9px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; border-radius:8px; border:none; background:var(--c-text-1); color:#fff; cursor:pointer; transition:opacity .15s; }
  .adc-success-btn:hover{ opacity:.8; }
`;

// ==========================================
// UTILITIES
// ==========================================
const formatDateTime = (isoString) => {
    if (!isoString) return 'TBD';
    return new Intl.DateTimeFormat('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(new Date(isoString));
};

const timeAgo = (isoString) => {
    if (!isoString) return '';
    const mins = Math.round((Date.now() - new Date(isoString)) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
};

// ==========================================
// SVG ICONS
// ==========================================
const IconBuilding = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 8h.01M15 8h.01M9 13h.01M15 13h.01"/>
    </svg>
);
const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M5 13l4 4L19 7"/>
    </svg>
);
const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
);
const IconRefresh = ({ spin }) => (
    <svg className={spin ? 'spin' : ''} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M1 4v6h6M23 20v-6h-6"/>
        <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
    </svg>
);
const IconUsers = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
);
const IconAlert = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
);
const IconBox = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
);

// ==========================================
// REJECT MODAL
// ==========================================
const RejectModal = ({ booking, onConfirm, onCancel, isLoading }) => {
    const [remarks, setRemarks] = useState('');
    return (
        <div className="adc-overlay">
            <div className="adc-modal">
                <div className="adc-modal-title">Reject booking</div>
                <div className="adc-modal-sub">
                    <strong>{booking.reference_code}</strong> · {booking.resource_name}
                </div>
                <div className="adc-modal-lbl">
                    Reason for rejection <span style={{ color: 'var(--c-red)' }}>*</span>
                </div>
                <textarea
                    className="adc-modal-ta"
                    placeholder="e.g. Conflicting schedule, missing documentation..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    autoFocus
                />
                <div className="adc-modal-hint">This message will be recorded against the booking.</div>
                <div className="adc-modal-acts">
                    <button className="adc-modal-cancel" onClick={onCancel} disabled={isLoading}>
                        Cancel
                    </button>
                    <button
                        className="adc-modal-confirm"
                        onClick={() => onConfirm(remarks)}
                        disabled={isLoading || !remarks.trim()}
                    >
                        {isLoading ? 'Rejecting…' : 'Confirm rejection'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// SUCCESS MODAL
// ==========================================
const SuccessModal = ({ booking, onClose }) => {
    if (!booking) return null;
    return (
        <div className="adc-overlay">
            <div className="adc-modal" style={{ maxWidth: 360, textAlign: 'center' }}>
                <div className="adc-success-icon"><IconCheck /></div>
                <div className="adc-success-title">Booking approved</div>
                <div className="adc-success-sub">
                    Request <strong>{booking.reference_code}</strong> for{' '}
                    <strong>{booking.resource_name}</strong> has been approved.
                </div>
                <button className="adc-success-btn" onClick={onClose}>Continue</button>
            </div>
        </div>
    );
};

// ==========================================
// BOOKING ROW
// ==========================================
const BookingRow = ({ booking, onApprove, onReject, isActing }) => {
    const hasEquipment = booking.equipment_requests && booking.equipment_requests.length > 0;
    const hasNotes = booking.user_notes && booking.user_notes.trim().length > 0;

    return (
        <div className="adc-row">
            {/* top strip */}
            <div className="adc-row-top">
                <div className="adc-row-top-left">
                    <span className="adc-ref">{booking.reference_code}</span>
                    {booking.attendee_count && (
                        <span className="adc-pax">
                            <IconUsers /> {booking.attendee_count} pax
                        </span>
                    )}
                </div>
                <span className="adc-ts">Requested {timeAgo(booking.created_at)}</span>
            </div>

            {/* 3-col info grid */}
            <div className="adc-grid">
                {/* Resource */}
                <div>
                    <div className="adc-col-lbl">Resource</div>
                    <div className="adc-resource">
                        <div className="adc-ricon"><IconBuilding /></div>
                        <div>
                            <div className="adc-rname">{booking.resource_name || 'Space'}</div>
                            <div className="adc-rdomain">Spaces · {booking.reference_code}</div>
                        </div>
                    </div>
                </div>

                {/* Schedule */}
                <div>
                    <div className="adc-col-lbl">Schedule</div>
                    <div className="adc-sched">
                        <div className="adc-srow">
                            <div className="adc-sline-wrap">
                                <span className="adc-sdot s" />
                                <span className="adc-sconnect" />
                            </div>
                            <div>
                                <span className="adc-slabel">Starts</span>
                                <span className="adc-sval">{formatDateTime(booking.start_datetime)}</span>
                            </div>
                        </div>
                        <div className="adc-srow">
                            <div className="adc-sline-wrap">
                                <span className="adc-sdot e" />
                            </div>
                            <div>
                                <span className="adc-slabel">Ends</span>
                                <span className="adc-sval">{formatDateTime(booking.end_datetime)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requester + Purpose */}
                <div>
                    <div className="adc-col-lbl">Requester & purpose</div>
                    <div className="adc-requester">
                        <div className="adc-avatar">
                            {booking.requester?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                            <div className="adc-rqname">{booking.requester}</div>
                            <div className="adc-rqdept">{booking.department || 'General Member'}</div>
                        </div>
                    </div>
                    <div className="adc-purpose">{booking.purpose || 'No purpose provided.'}</div>
                </div>
            </div>

            {/* Equipment and notes — rendered only when present */}
            {(hasEquipment || hasNotes) && (
                <div className="adc-extras">
                    {hasEquipment && (
                        <div>
                            <div className="adc-col-lbl" style={{ marginBottom: 6 }}>
                                Equipment requested
                            </div>
                            <div className="adc-eq-row">
                                {booking.equipment_requests.map((er) => (
                                    <span key={er.id} className="adc-eq-tag">
                                        <IconBox />
                                        {er.equipment_name}
                                        {er.quantity > 1 && (
                                            <span style={{ opacity: 0.65 }}>
                                                &nbsp;&times;&nbsp;{er.quantity}
                                            </span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {hasNotes && (
                        <div>
                            <div className="adc-notes-lbl">User notes</div>
                            <div className="adc-notes">{booking.user_notes}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="adc-actions">
                <button
                    className="adc-btn-rej"
                    onClick={() => onReject(booking)}
                    disabled={isActing}
                >
                    <IconX /> Reject
                </button>
                <button
                    className="adc-btn-app"
                    onClick={() => onApprove(booking)}
                    disabled={isActing}
                >
                    {isActing ? 'Processing…' : <><IconCheck /> Approve</>}
                </button>
            </div>
        </div>
    );
};

// ==========================================
// MAIN DASHBOARD
// ==========================================
const AdminDashboard = () => {
    const { can_manage_system, can_manage_mess } = useAuth();
    const navigate = useNavigate();

    const [pendingBookings, setPendingBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);
    const [refreshCount, setRefreshCount] = useState(0);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [successTarget, setSuccessTarget] = useState(null);

    useEffect(() => {
        let isMounted = true;

        if (can_manage_mess && !can_manage_system) {
            navigate('/admin/mess', { replace: true });
            return;
        }

        const fetchQueue = async () => {
            setIsLoading(true);
            try {
                const data = await approvalService.getPendingApprovals();
                if (isMounted) {
                    const cleanQueue = (data.queue || []).filter(
                        (b) => b.domain?.toLowerCase() !== 'mess'
                    );
                    setPendingBookings(cleanQueue);
                    setError(null);
                }
            } catch (err) {
                console.error('Fetch error:', err);
                if (isMounted) {
                    setError(
                        err.response?.status === 401
                            ? 'Your account lacks approver privileges.'
                            : 'Connection failed. Please check your backend server.'
                    );
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchQueue();
        return () => { isMounted = false; };
    }, [refreshCount, can_manage_system, can_manage_mess, navigate]);

    const handleRefresh = () => {
        setIsLoading(true);
        setRefreshCount((c) => c + 1);
    };

    const handleApprove = async (booking) => {
        setActionLoading(booking.id);
        try {
            await approvalService.resolveBooking({
                module: booking.domain,
                id: booking.id,
                status: 'APPROVED',
                remarks: '',
            });
            setPendingBookings((prev) => prev.filter((b) => b.id !== booking.id));
            setSuccessTarget(booking);
        } catch (err) {
            console.error('Approve error:', err);
            alert(err.response?.data?.error || 'Approval failed. Check admin permissions.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectConfirm = async (remarks) => {
        if (!rejectTarget) return;
        setActionLoading(rejectTarget.id);
        try {
            await approvalService.resolveBooking({
                module: rejectTarget.domain,
                id: rejectTarget.id,
                status: 'REJECTED',
                remarks,
            });
            setPendingBookings((prev) => prev.filter((b) => b.id !== rejectTarget.id));
            setRejectTarget(null);
        } catch (err) {
            console.error('Reject error:', err);
            alert(err.response?.data?.error || 'Rejection failed. Check admin permissions.');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="adc-root">
            <style>{STYLES}</style>

            {rejectTarget && (
                <RejectModal
                    booking={rejectTarget}
                    onConfirm={handleRejectConfirm}
                    onCancel={() => setRejectTarget(null)}
                    isLoading={actionLoading === rejectTarget.id}
                />
            )}
            {successTarget && (
                <SuccessModal
                    booking={successTarget}
                    onClose={() => setSuccessTarget(null)}
                />
            )}

            <div className="adc-page">
                {/* Top bar */}
                <div className="adc-topbar">
                    <div>
                        <div className="adc-eyebrow">Rajagiri College · Admin</div>
                        <div className="adc-title">Action center</div>
                        <div className="adc-sub">
                            {error
                                ? 'Authentication required'
                                : `${pendingBookings.length} pending request${pendingBookings.length !== 1 ? 's' : ''} awaiting review`}
                        </div>
                    </div>
                    <button
                        className="adc-refresh"
                        onClick={handleRefresh}
                        disabled={isLoading}
                    >
                        <IconRefresh spin={isLoading} />
                        Refresh
                    </button>
                </div>

                {/* Stat strip */}
                <div className="adc-stats">
                    <div className="adc-stat">
                        <div className="adc-stat-n">{pendingBookings.length}</div>
                        <div className="adc-stat-l">Total pending</div>
                    </div>
                    <div className="adc-stat">
                        <div className="adc-stat-n">
                            {pendingBookings.filter((b) => {
                                if (!b.start_datetime) return false;
                                const d = new Date(b.start_datetime);
                                const now = new Date();
                                return (
                                    d.getDate() === now.getDate() &&
                                    d.getMonth() === now.getMonth() &&
                                    d.getFullYear() === now.getFullYear()
                                );
                            }).length}
                        </div>
                        <div className="adc-stat-l">Scheduled today</div>
                    </div>
                    <div className="adc-stat">
                        <div className="adc-stat-n">
                            {pendingBookings.reduce((s, b) => s + (b.attendee_count || 0), 0)}
                        </div>
                        <div className="adc-stat-l">Total expected pax</div>
                    </div>
                </div>

                {/* Queue panel */}
                <div className="adc-panel">
                    <div className="adc-phead">
                        <span className="adc-phead-l">Pending approvals · All Modules</span>
                    </div>

                    {error ? (
                        <div className="adc-state">
                            <div className="adc-state-icon red"><IconAlert /></div>
                            <div className="adc-state-title">{error}</div>
                            <div className="adc-state-sub">Log out and back in to refresh your session.</div>
                        </div>
                    ) : isLoading && pendingBookings.length === 0 ? (
                        <div className="adc-state">
                            <div className="adc-state-sub">Loading resource queue…</div>
                        </div>
                    ) : pendingBookings.length === 0 ? (
                        <div className="adc-state">
                            <div className="adc-state-icon green"><IconCheck /></div>
                            <div className="adc-state-title">Queue clear</div>
                            <div className="adc-state-sub">All requests have been processed.</div>
                        </div>
                    ) : (
                        pendingBookings.map((booking) => (
                            <BookingRow
                                key={`${booking.domain}-${booking.id}`}
                                booking={booking}
                                onApprove={handleApprove}
                                onReject={setRejectTarget}
                                isActing={actionLoading === booking.id}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;