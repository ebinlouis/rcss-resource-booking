"""
apps/notifications/email_builder.py

Owns all email content construction for RCSS notifications.
Public interface: build_email(notification, booking, domain, approve_url=None)
Returns: (subject, plain_text, html)

Rules:
- Never import from utils.py (circular import risk).
- All booking model imports are inside functions.
- Every booking field access uses getattr(..., None) with safe fallbacks.
- Never raises — always returns something renderable.
"""

# ---------------------------------------------------------------------------
# Date / time formatting helpers (private, module-level)
# ---------------------------------------------------------------------------

def _fmt_dt(dt):
    """Formats a datetime to '8 Jun 2026, 10:00 AM'. Returns '' if None."""
    if not dt:
        return ''
    from django.utils import timezone
    local = timezone.localtime(dt)
    # Cross-platform: strip leading zero from day by lstrip then fix interior zeros
    return local.strftime('%d %b %Y, %I:%M %p').lstrip('0').replace(' 0', ' ')


def _fmt_date(d):
    """Formats a date to '8 Jun 2026'. Returns '' if None."""
    if not d:
        return ''
    return d.strftime('%d %b %Y').lstrip('0').replace(' 0', ' ')


def _fmt_time(t):
    """Formats a time to '10:00 AM'. Returns '' if None."""
    if not t:
        return ''
    return t.strftime('%I:%M %p').lstrip('0')


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def build_email(notification, booking, domain, approve_url=None):
    """
    Returns (subject, plain_text, html) for any notification/domain combination.

    notification : Notification model instance (always present)
    booking      : booking model instance or None
    domain       : 'spaces' | 'fleet' | 'mess' | 'media' | 'spaces_faculty'
    approve_url  : one-click approve URL string, or None
    """
    # Guard: if booking is None return a minimal fallback email
    if booking is None:
        return _minimal_email(notification)

    from apps.notifications.models import Notification
    C = Notification.Category
    category = notification.category

    if domain == 'media':
        if category == C.BOOKING_PENDING:
            return _media_incharge_email(notification, booking)
        elif category == C.BOOKING_APPROVED:
            return _media_approved_requester_email(notification, booking)
        else:
            return _requester_status_email(notification, booking, domain)

    # All other domains
    if notification.is_actionable:
        return _approver_email(notification, booking, domain, approve_url)
    else:
        return _requester_status_email(notification, booking, domain)


# ---------------------------------------------------------------------------
# HTML scaffold helpers
# ---------------------------------------------------------------------------

_HEADER_COLOR = '#1a5c38'
_LABEL_STYLE = 'font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#888;margin:0 0 2px 0;'
_VALUE_STYLE = 'font-size:14px;color:#222;margin:0 0 0 0;'
_DIVIDER = '<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">'


def _html_wrap(header_title, header_subtitle, body_html, footer_ref, button_html=''):
    """Returns a complete email HTML string using the shared scaffold."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:{_HEADER_COLOR};padding:24px 32px;">
              <p style="margin:0;font-size:16px;font-weight:bold;color:#ffffff;">{header_title}</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:rgba(255,255,255,.75);">Campus Resource Booking System</p>
              {f'<p style="margin:6px 0 0 0;font-size:11px;color:rgba(255,255,255,.6);">{header_subtitle}</p>' if header_subtitle else ''}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 32px;">
              {body_html}
              {button_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
              <p style="margin:0;font-size:11px;color:#888;">Reference: {footer_ref} &middot; RCSS &middot; Campus Resource Booking System</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _section(label, value_html):
    """Returns one labelled section block."""
    return f"""<p style="{_LABEL_STYLE}">{label}</p>
<p style="{_VALUE_STYLE}">{value_html}</p>"""


def _approve_button_html(approve_url):
    """Returns the full approve button HTML, or a plain fallback if url is None."""
    if not approve_url:
        return '<p style="font-size:13px;color:#555;margin-top:20px;">Log in to the dashboard to action this request.</p>'
    return f"""<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
  <tr>
    <td align="center">
      <a href="{approve_url}"
         style="display:inline-block;width:100%;max-width:400px;padding:14px 0;
                background:#1a5c38;color:#ffffff;text-decoration:none;
                border-radius:6px;font-size:15px;font-weight:bold;
                text-align:center;box-sizing:border-box;">
        &#10003; Approve This Request
      </a>
    </td>
  </tr>
</table>
<p style="text-align:center;font-size:11px;color:#888;margin-top:8px;">
  This link is valid until the booking&#39;s scheduled time passes and can only be used once.
  To reject, please log in to the dashboard.
</p>"""


def _view_booking_button(url, label='View My Booking &rarr;', color='#1a5c38'):
    if not url:
        return ''
    return f"""<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
  <tr>
    <td align="center">
      <a href="{url}"
         style="display:inline-block;padding:12px 32px;background:{color};
                color:#ffffff;text-decoration:none;border-radius:6px;
                font-size:14px;font-weight:bold;">
        {label}
      </a>
    </td>
  </tr>
</table>"""


def _remarks_box(remarks):
    if not remarks:
        return ''
    return f"""<div style="border-left:3px solid #c62828;background:#fff5f5;padding:12px 16px;margin-top:12px;border-radius:4px;">
  <p style="margin:0 0 4px 0;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#c62828;">Remarks from Incharge</p>
  <p style="margin:0;font-size:14px;color:#222;">{remarks}</p>
</div>"""


def _user_info_html(user):
    """Returns formatted HTML lines for a user."""
    if not user:
        return '—'
    name = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip() or '—'
    dept = getattr(getattr(user, 'department', None), 'department_name', None) or ''
    email = getattr(user, 'email', '') or ''
    phone = getattr(user, 'phone', '') or ''
    parts = [f'<strong>{name}</strong>']
    if dept:
        parts.append(dept)
    if email:
        parts.append(email)
    if phone:
        parts.append(phone)
    return '<br>'.join(parts)


def _user_info_plain(user):
    if not user:
        return '—'
    name = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip() or '—'
    dept = getattr(getattr(user, 'department', None), 'department_name', None) or ''
    email = getattr(user, 'email', '') or ''
    phone = getattr(user, 'phone', '') or ''
    parts = [name]
    if dept:
        parts.append(dept)
    if email:
        parts.append(email)
    if phone:
        parts.append(phone)
    return ' | '.join(parts)


def _status_badge_html(category):
    """Returns a coloured inline badge for the notification status."""
    from apps.notifications.models import Notification
    C = Notification.Category
    if category in (C.BOOKING_APPROVED, C.FACULTY_APPROVED):
        bg, word = '#1a5c38', 'APPROVED'
    elif category in (C.BOOKING_REJECTED, C.FACULTY_REJECTED):
        bg, word = '#c62828', 'REJECTED'
    elif category == C.BOOKING_CANCELLED:
        bg, word = '#c62828', 'CANCELLED'
    elif category == C.SYSTEM:
        bg, word = '#555', 'EXPIRED'
    else:
        bg, word = '#555', category
    return (
        f'<span style="display:inline-block;background:{bg};color:#fff;'
        f'font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;'
        f'letter-spacing:.06em;">{word}</span>'
    )


# ---------------------------------------------------------------------------
# Fallback for missing booking
# ---------------------------------------------------------------------------

def _minimal_email(notification):
    subject = notification.title
    plain = f"{notification.title}\n\n{notification.message}"
    body_html = f"""<p style="font-size:16px;font-weight:bold;color:#222;">{notification.title}</p>
<p style="font-size:14px;color:#444;line-height:1.6;">{notification.message}</p>"""
    html = _html_wrap(notification.title, '', body_html, 'N/A')
    return subject, plain, html


# ---------------------------------------------------------------------------
# _approver_email — incharge receives a new request needing action
# ---------------------------------------------------------------------------

def _approver_email(notification, booking, domain, approve_url):
    if domain in ('spaces', 'spaces_faculty'):
        return _space_approver_email(notification, booking, approve_url)
    if domain == 'mess':
        return _mess_approver_email(notification, booking, approve_url)
    if domain == 'fleet':
        return _fleet_approver_email(notification, booking, approve_url)
    return _minimal_email(notification)


def _space_approver_email(notification, booking, approve_url):
    space = getattr(booking, 'space', None)
    space_name = getattr(space, 'name', None) or 'Unknown Venue'
    space_type_raw = getattr(space, 'space_type', None) or ''
    # Human-readable space type
    space_type_display = space_type_raw.replace('_', ' ').title() if space_type_raw else ''
    block = getattr(space, 'block', None)
    block_name = getattr(block, 'name', None) or ''

    start_dt = getattr(booking, 'start_datetime', None)
    end_dt = getattr(booking, 'end_datetime', None)
    attendees = getattr(booking, 'attendee_count', None) or '—'
    purpose = getattr(booking, 'purpose_of_booking', None) or '—'
    user_notes = getattr(booking, 'user_notes', None) or ''
    user = getattr(booking, 'user', None)
    ref = getattr(booking, 'reference_code', '') or ''

    subject = f"New Venue Request - {space_name}"

    # Equipment
    equip_items = []
    try:
        for er in booking.requested_equipment.select_related('equipment').all():
            equip_items.append(f"{er.quantity}x {er.equipment.name}")
    except Exception:
        pass

    # ── Plain text ──────────────────────────────────────────────────────────
    lines = [
        f"New Venue Request — Action Required",
        f"",
        f"VENUE: {space_name}" + (f" ({space_type_display})" if space_type_display else '') + (f" | Block: {block_name}" if block_name else ''),
        f"WHEN: {_fmt_dt(start_dt)} → {_fmt_dt(end_dt)}",
        f"ATTENDEES: {attendees}",
        f"REQUESTED BY: {_user_info_plain(user)}",
        f"EVENT PURPOSE: {purpose}",
    ]
    if equip_items:
        lines.append(f"EQUIPMENT NEEDED: {', '.join(equip_items)}")
    if user_notes:
        lines.append(f"NOTES FROM REQUESTER: {user_notes}")
    if approve_url:
        lines += ['', f"ONE-CLICK APPROVE: {approve_url}", '(Link valid until booking start; single-use only.)']
    plain = '\n'.join(lines)

    # ── HTML body ───────────────────────────────────────────────────────────
    space_title_html = f'<strong style="font-size:18px;">{space_name}</strong>'
    if space_type_display:
        space_title_html += f'<br><span style="font-size:12px;color:#888;">{space_type_display}</span>'
    if block_name:
        space_title_html += f'<br><span style="font-size:12px;color:#aaa;">{block_name}</span>'

    body_parts = [
        _section('VENUE', space_title_html),
        _DIVIDER,
        _section('WHEN', f'{_fmt_dt(start_dt)}&nbsp;&nbsp;&rarr;&nbsp;&nbsp;{_fmt_dt(end_dt)}'),
        _DIVIDER,
        _section('ATTENDEES', f'{attendees} people'),
        _DIVIDER,
        _section('REQUESTED BY', _user_info_html(user)),
        _DIVIDER,
        _section('EVENT PURPOSE', f'<span style="white-space:pre-line;">{purpose}</span>'),
    ]
    if equip_items:
        body_parts += [_DIVIDER, _section('EQUIPMENT NEEDED', '<br>'.join(equip_items))]
    if user_notes:
        body_parts += [_DIVIDER, _section('NOTES FROM REQUESTER', f'<span style="white-space:pre-line;">{user_notes}</span>')]

    body_html = '\n'.join(body_parts)
    button = _approve_button_html(approve_url)
    html = _html_wrap('New Venue Request', 'Action required — please review and approve or reject', body_html, ref, button)
    return subject, plain, html


def _mess_approver_email(notification, booking, approve_url):
    purpose = getattr(booking, 'purpose_of_programme', None) or 'Catering Request'
    delivery = getattr(booking, 'delivery_location', None) or '—'
    start_date = getattr(booking, 'start_date', None)
    end_date = getattr(booking, 'end_date', None)
    user = getattr(booking, 'user', None)
    ref = getattr(booking, 'reference_code', '') or ''

    truncated = purpose[:40] + '…' if len(purpose) > 40 else purpose
    is_multi = start_date and end_date and start_date != end_date
    days = ((end_date - start_date).days + 1) if (start_date and end_date) else 1
    subject = (
        f"New Catering Request - {days} Days - {truncated}"
        if is_multi else
        f"New Catering Request - {truncated}"
    )

    date_display = (
        f"{_fmt_date(start_date)} → {_fmt_date(end_date)} ({days} Days)"
        if is_multi else _fmt_date(start_date)
    )

    # Daily menus
    try:
        menus = list(booking.daily_menus.all().order_by('date'))
    except Exception:
        menus = []

    meal_fields = [
        ('breakfast_time', 'breakfast_menu', 'Breakfast'),
        ('morning_tea_time', 'morning_snack_option', 'Morning Tea'),
        ('lunch_time', 'lunch_menu', 'Lunch'),
        ('evening_tea_time', 'evening_snack_option', 'Evening Tea'),
        ('dinner_time', 'dinner_menu', 'Dinner'),
    ]

    def _days_identical(menus):
        if len(menus) <= 1:
            return True
        first = menus[0]
        for m in menus[1:]:
            if (m.total_persons != first.total_persons or
                    m.veg_persons != first.veg_persons or
                    m.nonveg_persons != first.nonveg_persons):
                return False
            for time_f, menu_f, _ in meal_fields:
                if getattr(m, time_f, None) != getattr(first, time_f, None):
                    return False
                if getattr(m, menu_f, None) != getattr(first, menu_f, None):
                    return False
        return True

    def _meals_plain(menu):
        rows = []
        for time_f, menu_f, label in meal_fields:
            t = getattr(menu, time_f, None)
            if t:
                menu_text = getattr(menu, menu_f, None) or ''
                rows.append(f"  {label}  {_fmt_time(t)}" + (f"  —  {menu_text}" if menu_text else ''))
        return rows

    def _meals_html(menu):
        rows = []
        for time_f, menu_f, label in meal_fields:
            t = getattr(menu, time_f, None)
            if t:
                menu_text = getattr(menu, menu_f, None) or ''
                row = f'<tr><td style="padding:4px 8px 4px 0;font-size:13px;color:#555;white-space:nowrap;">{label}</td><td style="padding:4px 8px;font-size:13px;color:#555;white-space:nowrap;">{_fmt_time(t)}</td><td style="padding:4px 0;font-size:13px;color:#222;">{menu_text}</td></tr>'
                rows.append(row)
        if not rows:
            return ''
        return '<table cellpadding="0" cellspacing="0">' + ''.join(rows) + '</table>'

    # ── Plain text ──────────────────────────────────────────────────────────
    plain_lines = [
        f"New Catering Request — Action Required",
        f"",
        f"EVENT: {purpose}",
        f"REQUESTED BY: {_user_info_plain(user)}",
        f"DELIVERY LOCATION: {delivery}",
        f"DATE: {date_display}",
        f"",
    ]
    if menus:
        identical = _days_identical(menus)
        if identical:
            m = menus[0]
            plain_lines += [
                f"HEADCOUNT (ALL DAYS)",
                f"  Veg: {m.veg_persons}  Non-Veg: {m.nonveg_persons}  Total: {m.total_persons}",
                f"",
                f"MENU (SAME EVERY DAY)",
            ]
            plain_lines += _meals_plain(m)
        else:
            for i, m in enumerate(menus, 1):
                day_label = m.date.strftime('%a, %-d %b') if hasattr(m.date, 'strftime') else str(m.date)
                plain_lines.append(f"DAY {i} — {day_label}")
                plain_lines.append(f"  Veg: {m.veg_persons}  Non-Veg: {m.nonveg_persons}  Total: {m.total_persons}")
                plain_lines += _meals_plain(m)
                plain_lines.append('')
    if approve_url:
        plain_lines += ['', f"ONE-CLICK APPROVE: {approve_url}"]
    plain = '\n'.join(plain_lines)

    # ── HTML body ───────────────────────────────────────────────────────────
    body_parts = [
        _section('EVENT', f'<span style="white-space:pre-line;">{purpose}</span>'),
        _DIVIDER,
        _section('REQUESTED BY', _user_info_html(user)),
        _DIVIDER,
        _section('DELIVERY LOCATION', delivery),
        _DIVIDER,
        _section('DATE', date_display),
    ]

    if menus:
        identical = _days_identical(menus)
        body_parts.append(_DIVIDER)
        if identical:
            m = menus[0]
            body_parts.append(
                _section('HEADCOUNT (ALL DAYS)',
                         f'Veg: {m.veg_persons}&nbsp;&nbsp;&nbsp;Non-Veg: {m.nonveg_persons}&nbsp;&nbsp;&nbsp;Total: {m.total_persons}')
            )
            meals_h = _meals_html(m)
            if meals_h:
                body_parts.append(_DIVIDER)
                body_parts.append(_section('MENU (SAME EVERY DAY)', meals_h))
        else:
            for i, m in enumerate(menus, 1):
                day_label = m.date.strftime('%a, %d %b').replace(' 0', ' ') if hasattr(m.date, 'strftime') else str(m.date)
                body_parts.append(
                    f'<p style="font-size:12px;font-weight:bold;color:#1a5c38;margin:12px 0 4px 0;">DAY {i} — {day_label}</p>'
                )
                body_parts.append(
                    f'<p style="{_VALUE_STYLE}">Veg: {m.veg_persons}&nbsp;&nbsp;&nbsp;Non-Veg: {m.nonveg_persons}&nbsp;&nbsp;&nbsp;Total: {m.total_persons}</p>'
                )
                meals_h = _meals_html(m)
                if meals_h:
                    body_parts.append(meals_h)

    body_html = '\n'.join(body_parts)
    button = _approve_button_html(approve_url)
    html = _html_wrap('New Catering Request', 'Action required — please review and approve or reject', body_html, ref, button)
    return subject, plain, html


def _fleet_approver_email(notification, booking, approve_url):
    vehicle = getattr(booking, 'vehicle', None)
    veh_name = getattr(vehicle, 'name', None) or 'Vehicle'
    veh_reg = getattr(vehicle, 'registration_number', None) or ''
    veh_cap = getattr(vehicle, 'capacity', None)
    purpose = getattr(booking, 'purpose', None) or '—'
    start_dt = getattr(booking, 'start_datetime', None)
    end_dt = getattr(booking, 'end_datetime', None)
    pickup = getattr(booking, 'pickup_location', None) or '—'
    dest = getattr(booking, 'destination', None) or '—'
    passengers = getattr(booking, 'total_passengers', None) or '—'
    user = getattr(booking, 'user', None)
    ref = getattr(booking, 'reference_code', '') or ''

    subject = f"New Transport Request - {veh_name}"

    veh_line = veh_name
    if veh_reg:
        veh_line += f' · {veh_reg}'
    if veh_cap is not None:
        veh_line += f' · Capacity: {veh_cap} passengers'

    plain = '\n'.join([
        f"New Transport Request — Action Required",
        f"",
        f"VEHICLE: {veh_line}",
        f"TRIP: {pickup}  →  {dest}",
        f"TRAVEL TIME: {_fmt_dt(start_dt)}  →  {_fmt_dt(end_dt)}",
        f"PASSENGERS: {passengers}",
        f"PURPOSE: {purpose}",
        f"REQUESTED BY: {_user_info_plain(user)}",
    ] + (['', f"ONE-CLICK APPROVE: {approve_url}"] if approve_url else []))

    veh_html = f'<strong style="font-size:18px;">{veh_name}</strong>'
    if veh_reg:
        veh_html += f'<br><span style="font-size:12px;color:#888;">{veh_reg}</span>'
    if veh_cap is not None:
        veh_html += f'<br><span style="font-size:12px;color:#888;">Capacity: {veh_cap} passengers</span>'

    body_parts = [
        _section('VEHICLE', veh_html),
        _DIVIDER,
        _section('TRIP', f'{pickup}&nbsp;&nbsp;&rarr;&nbsp;&nbsp;{dest}'),
        _DIVIDER,
        _section('TRAVEL TIME', f'{_fmt_dt(start_dt)}&nbsp;&nbsp;&rarr;&nbsp;&nbsp;{_fmt_dt(end_dt)}'),
        _DIVIDER,
        _section('PASSENGERS', str(passengers)),
        _DIVIDER,
        _section('PURPOSE', f'<span style="white-space:pre-line;">{purpose}</span>'),
        _DIVIDER,
        _section('REQUESTED BY', _user_info_html(user)),
    ]
    body_html = '\n'.join(body_parts)
    button = _approve_button_html(approve_url)
    html = _html_wrap('New Transport Request', 'Action required — please review and approve or reject', body_html, ref, button)
    return subject, plain, html


# ---------------------------------------------------------------------------
# _requester_status_email — requester receives outcome
# ---------------------------------------------------------------------------

def _requester_status_email(notification, booking, domain):
    import re
    from django.conf import settings as django_settings

    raw_title = notification.title or ''
    subject = re.sub(r'(?i)\bspaces?\b', 'Venue', raw_title)

    badge_html = _status_badge_html(notification.category)
    msg = notification.message or ''
    ref = getattr(booking, 'reference_code', '') or ''

    frontend_base = getattr(django_settings, 'FRONTEND_BASE_URL', 'http://localhost:5173')
    link = getattr(notification, 'link', None) or ''
    view_url = f"{frontend_base}{link}" if link else ''

    # Domain-specific details block
    details_plain = []
    details_html_parts = []

    if domain in ('spaces', 'spaces_faculty'):
        space = getattr(booking, 'space', None)
        space_name = getattr(space, 'name', None) or '—'
        start_dt = getattr(booking, 'start_datetime', None)
        end_dt = getattr(booking, 'end_datetime', None)
        remarks = getattr(booking, 'remarks_by_admin', None) or ''

        details_plain = [
            f"Venue: {space_name}",
            f"When: {_fmt_dt(start_dt)} → {_fmt_dt(end_dt)}",
            f"Reference: {ref}",
        ]
        if remarks:
            details_plain.append(f"Remarks: {remarks}")

        details_html_parts = [
            _section('VENUE', f'<strong>{space_name}</strong>'),
            _DIVIDER,
            _section('WHEN', f'{_fmt_dt(start_dt)}&nbsp;&nbsp;&rarr;&nbsp;&nbsp;{_fmt_dt(end_dt)}'),
            _DIVIDER,
            _section('REFERENCE', ref),
        ]
        if remarks:
            details_html_parts.append(_remarks_box(remarks))

    elif domain == 'mess':
        start_date = getattr(booking, 'start_date', None)
        end_date = getattr(booking, 'end_date', None)
        delivery = getattr(booking, 'delivery_location', None) or '—'
        rejection_remark = getattr(booking, 'rejection_remark', None) or ''

        date_display = (
            f"{_fmt_date(start_date)} → {_fmt_date(end_date)}"
            if (start_date and end_date and start_date != end_date)
            else _fmt_date(start_date)
        )

        details_plain = [
            f"Date: {date_display}",
            f"Delivery Location: {delivery}",
            f"Reference: {ref}",
        ]
        if rejection_remark:
            details_plain.append(f"Remarks: {rejection_remark}")

        details_html_parts = [
            _section('DATE', date_display),
            _DIVIDER,
            _section('DELIVERY LOCATION', delivery),
            _DIVIDER,
            _section('REFERENCE', ref),
        ]
        if rejection_remark:
            details_html_parts.append(_remarks_box(rejection_remark))

    elif domain == 'fleet':
        vehicle = getattr(booking, 'vehicle', None)
        veh_name = getattr(vehicle, 'name', None) or '—'
        pickup = getattr(booking, 'pickup_location', None) or '—'
        dest = getattr(booking, 'destination', None) or '—'
        start_dt = getattr(booking, 'start_datetime', None)
        end_dt = getattr(booking, 'end_datetime', None)
        remarks = getattr(booking, 'remarks_by_admin', None) or ''

        details_plain = [
            f"Vehicle: {veh_name}",
            f"Trip: {pickup} → {dest}",
            f"Travel Time: {_fmt_dt(start_dt)} → {_fmt_dt(end_dt)}",
            f"Reference: {ref}",
        ]
        if remarks:
            details_plain.append(f"Remarks: {remarks}")

        details_html_parts = [
            _section('VEHICLE', f'<strong>{veh_name}</strong>'),
            _DIVIDER,
            _section('TRIP', f'{pickup}&nbsp;&nbsp;&rarr;&nbsp;&nbsp;{dest}'),
            _DIVIDER,
            _section('TRAVEL TIME', f'{_fmt_dt(start_dt)}&nbsp;&nbsp;&rarr;&nbsp;&nbsp;{_fmt_dt(end_dt)}'),
            _DIVIDER,
            _section('REFERENCE', ref),
        ]
        if remarks:
            details_html_parts.append(_remarks_box(remarks))

    elif domain == 'media':
        event_name = getattr(booking, 'event_name', None) or '—'
        setup_start = getattr(booking, 'setup_start_datetime', None)
        event_start = getattr(booking, 'event_start_datetime', None)
        event_end = getattr(booking, 'event_end_datetime', None)
        teardown_end = getattr(booking, 'teardown_end_datetime', None)
        remarks = getattr(booking, 'remarks_by_admin', None) or ''

        date_display = ''
        if event_start and event_end:
            date_display = f"{_fmt_dt(event_start)} → {_fmt_dt(event_end)}"
        elif event_start:
            date_display = _fmt_dt(event_start)
        elif setup_start:
            date_display = _fmt_dt(setup_start)

        details_plain = [
            f"Event: {event_name}",
            f"When: {date_display}",
            f"Reference: {ref}",
        ]
        if remarks:
            details_plain.append(f"Remarks: {remarks}")

        details_html_parts = [
            _section('EVENT', f'<strong>{event_name}</strong>'),
            _DIVIDER,
            _section('WHEN', date_display),
            _DIVIDER,
            _section('REFERENCE', ref),
        ]
        if remarks:
            details_html_parts.append(_remarks_box(remarks))

    # ── Plain text ──────────────────────────────────────────────────────────
    plain_lines = [subject, '', msg, '']
    plain_lines += details_plain
    if view_url:
        plain_lines += ['', f"View your booking: {view_url}"]
    plain = '\n'.join(plain_lines)

    # ── HTML body ───────────────────────────────────────────────────────────
    body_html = f"""<p style="margin:0 0 16px 0;">{badge_html}</p>
<p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 20px 0;">{msg}</p>
{_DIVIDER}
{''.join(details_html_parts)}"""

    button = _view_booking_button(view_url) if view_url else ''
    html = _html_wrap(subject, '', body_html, ref, button)
    return subject, plain, html


# ---------------------------------------------------------------------------
# _media_incharge_email — media incharge receives a new request
# ---------------------------------------------------------------------------

def _media_incharge_email(notification, booking):
    from django.conf import settings as django_settings

    event_name = getattr(booking, 'event_name', None) or 'Media Request'
    space = getattr(booking, 'space', None)
    space_name = getattr(space, 'name', None) or ''
    is_team = getattr(booking, 'is_team_request', False)
    setup_start = getattr(booking, 'setup_start_datetime', None)
    event_start = getattr(booking, 'event_start_datetime', None)
    event_end = getattr(booking, 'event_end_datetime', None)
    teardown_end = getattr(booking, 'teardown_end_datetime', None)
    requested_services = getattr(booking, 'requested_services', None) or ''
    user = getattr(booking, 'user', None)
    ref = getattr(booking, 'reference_code', '') or ''

    subject = f"New Media Request - {event_name}"
    request_label = 'Media Team Request' if is_team else 'Equipment Only'

    # Timeline rows — include setup/teardown only if they differ from event times
    timeline_rows_plain = [f"  Event:       {_fmt_dt(event_start)} → {_fmt_dt(event_end)}"]
    timeline_rows_html = [
        f'<tr><td style="padding:3px 16px 3px 0;font-size:13px;color:#888;white-space:nowrap;">Event</td>'
        f'<td style="font-size:13px;color:#222;">{_fmt_dt(event_start)}&nbsp;&nbsp;&rarr;&nbsp;&nbsp;{_fmt_dt(event_end)}</td></tr>'
    ]
    if setup_start and event_start and setup_start != event_start:
        timeline_rows_plain.insert(0, f"  Setup:       {_fmt_dt(setup_start)}")
        timeline_rows_html.insert(0,
            f'<tr><td style="padding:3px 16px 3px 0;font-size:13px;color:#888;white-space:nowrap;">Setup Time</td>'
            f'<td style="font-size:13px;color:#222;">{_fmt_dt(setup_start)}</td></tr>'
        )
    if teardown_end and event_end and teardown_end != event_end:
        timeline_rows_plain.append(f"  Pack-up:     {_fmt_dt(teardown_end)}")
        timeline_rows_html.append(
            f'<tr><td style="padding:3px 16px 3px 0;font-size:13px;color:#888;white-space:nowrap;">Pack-up Time</td>'
            f'<td style="font-size:13px;color:#222;">{_fmt_dt(teardown_end)}</td></tr>'
        )

    # Equipment requests
    equip_items = []
    try:
        for er in booking.equipment_requests.select_related('equipment').all():
            equip_items.append(f"{er.quantity}x {er.equipment.name}")
    except Exception:
        pass

    # ── Plain text ──────────────────────────────────────────────────────────
    plain_lines = [
        f"New Media Request — Action Required",
        f"",
        f"EVENT: {event_name} ({request_label})",
    ]
    if space_name:
        plain_lines.append(f"VENUE: {space_name}")
    plain_lines += [f"TIMELINE:", ] + timeline_rows_plain
    plain_lines.append(f"REQUESTED BY: {_user_info_plain(user)}")
    if equip_items:
        plain_lines.append(f"EQUIPMENT REQUESTED: {', '.join(equip_items)}")
    if requested_services:
        plain_lines.append(f"REQUESTED SERVICES: {requested_services}")
    plain = '\n'.join(plain_lines)

    # ── HTML body ───────────────────────────────────────────────────────────
    badge_color = '#1565c0' if is_team else '#555'
    event_html = (
        f'<strong style="font-size:18px;">{event_name}</strong><br>'
        f'<span style="display:inline-block;margin-top:6px;background:{badge_color};color:#fff;'
        f'font-size:11px;font-weight:bold;padding:3px 10px;border-radius:12px;">{request_label}</span>'
    )

    body_parts = [_section('EVENT', event_html)]
    if space_name:
        body_parts += [_DIVIDER, _section('VENUE', space_name)]

    timeline_table = '<table cellpadding="0" cellspacing="0">' + ''.join(timeline_rows_html) + '</table>'
    body_parts += [_DIVIDER, _section('TIMELINE', timeline_table)]
    body_parts += [_DIVIDER, _section('REQUESTED BY', _user_info_html(user))]
    if equip_items:
        body_parts += [_DIVIDER, _section('EQUIPMENT REQUESTED', '<br>'.join(equip_items))]
    if requested_services:
        body_parts += [_DIVIDER, _section('REQUESTED SERVICES', f'<span style="white-space:pre-line;">{requested_services}</span>')]

    body_html = '\n'.join(body_parts)

    frontend_base = getattr(django_settings, 'FRONTEND_BASE_URL', 'http://localhost:5173')
    dashboard_url = f"{frontend_base}/admin/media?tab=pending&booking={ref}"
    button = _view_booking_button(dashboard_url, label='View Request in Dashboard &rarr;', color='#1565c0')
    html = _html_wrap('New Media Request', 'Action required — please review and assign crew', body_html, ref, button)
    return subject, plain, html


# ---------------------------------------------------------------------------
# _media_approved_requester_email — requester receives media approval
# ---------------------------------------------------------------------------

def _media_approved_requester_email(notification, booking):
    from django.conf import settings as django_settings

    event_name = getattr(booking, 'event_name', None) or 'Your Event'
    space = getattr(booking, 'space', None)
    space_name = getattr(space, 'name', None) or ''
    setup_start = getattr(booking, 'setup_start_datetime', None)
    event_start = getattr(booking, 'event_start_datetime', None)
    event_end = getattr(booking, 'event_end_datetime', None)
    teardown_end = getattr(booking, 'teardown_end_datetime', None)
    ref = getattr(booking, 'reference_code', '') or ''

    subject = f"Your Media Request was Approved - {event_name}"

    # Timeline rows
    timeline_rows_plain = [f"  Event:       {_fmt_dt(event_start)} → {_fmt_dt(event_end)}"]
    timeline_rows_html = [
        f'<tr><td style="padding:3px 16px 3px 0;font-size:13px;color:#888;white-space:nowrap;">Event</td>'
        f'<td style="font-size:13px;color:#222;">{_fmt_dt(event_start)}&nbsp;&nbsp;&rarr;&nbsp;&nbsp;{_fmt_dt(event_end)}</td></tr>'
    ]
    if setup_start and event_start and setup_start != event_start:
        timeline_rows_plain.insert(0, f"  Setup:       {_fmt_dt(setup_start)}")
        timeline_rows_html.insert(0,
            f'<tr><td style="padding:3px 16px 3px 0;font-size:13px;color:#888;white-space:nowrap;">Setup Time</td>'
            f'<td style="font-size:13px;color:#222;">{_fmt_dt(setup_start)}</td></tr>'
        )
    if teardown_end and event_end and teardown_end != event_end:
        timeline_rows_plain.append(f"  Pack-up:     {_fmt_dt(teardown_end)}")
        timeline_rows_html.append(
            f'<tr><td style="padding:3px 16px 3px 0;font-size:13px;color:#888;white-space:nowrap;">Pack-up Time</td>'
            f'<td style="font-size:13px;color:#222;">{_fmt_dt(teardown_end)}</td></tr>'
        )

    # Crew
    crew_plain = []
    crew_html_rows = []
    try:
        for member in booking.assigned_crew.all():
            name = f"{getattr(member, 'first_name', '') or ''} {getattr(member, 'last_name', '') or ''}".strip()
            phone = getattr(member, 'phone', '') or ''
            email = getattr(member, 'email', '') or ''
            crew_plain.append(f"  {name}" + (f" | {phone}" if phone else '') + (f" | {email}" if email else ''))
            crew_html_rows.append(
                f'<p style="margin:4px 0;font-size:13px;color:#222;"><strong>{name}</strong>'
                + (f'<br><span style="color:#888;">{phone}</span>' if phone else '')
                + (f'<br><span style="color:#888;">{email}</span>' if email else '')
                + '</p>'
            )
    except Exception:
        pass

    # Equipment
    equip_items = []
    try:
        for er in booking.equipment_requests.select_related('equipment').all():
            equip_items.append(f"{er.quantity}x {er.equipment.name}")
    except Exception:
        pass

    # ── Plain text ──────────────────────────────────────────────────────────
    plain_lines = [
        f"Your Media Request was Approved",
        f"",
        f"EVENT: {event_name}  |  Reference: {ref}",
    ]
    if space_name:
        plain_lines.append(f"VENUE: {space_name}")
    plain_lines += ['TIMELINE:'] + timeline_rows_plain
    plain_lines.append('ASSIGNED CREW:')
    if crew_plain:
        plain_lines += crew_plain
    else:
        plain_lines.append('  Crew will be assigned shortly.')
    if equip_items:
        plain_lines.append(f"EQUIPMENT ASSIGNED: {', '.join(equip_items)}")
    plain = '\n'.join(plain_lines)

    # ── HTML body ───────────────────────────────────────────────────────────
    badge_html = _status_badge_html(__import__('apps.notifications.models', fromlist=['Notification']).Notification.Category.BOOKING_APPROVED)

    event_html = f'<strong style="font-size:18px;">{event_name}</strong><br><span style="font-size:12px;color:#888;">Reference: {ref}</span>'
    body_parts = [
        f'<p style="margin:0 0 16px 0;">{badge_html}</p>',
        _section('EVENT', event_html),
    ]
    if space_name:
        body_parts += [_DIVIDER, _section('VENUE', space_name)]

    timeline_table = '<table cellpadding="0" cellspacing="0">' + ''.join(timeline_rows_html) + '</table>'
    body_parts += [_DIVIDER, _section('TIMELINE', timeline_table)]

    crew_content = ''.join(crew_html_rows) if crew_html_rows else '<p style="font-size:13px;color:#888;margin:0;">Crew will be assigned shortly.</p>'
    body_parts += [_DIVIDER, _section('ASSIGNED CREW', crew_content)]

    if equip_items:
        body_parts += [_DIVIDER, _section('EQUIPMENT ASSIGNED', '<br>'.join(equip_items))]

    body_html = '\n'.join(body_parts)

    frontend_base = getattr(django_settings, 'FRONTEND_BASE_URL', 'http://localhost:5173')
    link = getattr(notification, 'link', None) or ''
    view_url = f"{frontend_base}{link}" if link else ''
    button = _view_booking_button(view_url)
    html = _html_wrap(f'Your Media Request was Approved', '', body_html, ref, button)
    return subject, plain, html
