from urllib.parse import parse_qs, unquote, urlparse

from django.db import migrations, models


def _domain_from_link(link):
    path = urlparse(link or '').path
    if path.startswith('/admin/media') or path.startswith('/media/'):
        return 'media'
    if path.startswith('/admin/mess') or path.startswith('/mess'):
        return 'mess'
    if path.startswith('/admin/transport') or path.startswith('/transport'):
        return 'fleet'
    if path.startswith('/admin') or path.startswith('/bookings/'):
        return 'spaces'
    return ''


def _reference_from_link(link):
    parsed = urlparse(link or '')
    query_ref = parse_qs(parsed.query).get('booking', [''])[0]
    if query_ref:
        return unquote(query_ref)

    parts = [part for part in parsed.path.split('/') if part]
    if len(parts) >= 2 and parts[0] == 'bookings':
        return unquote(parts[1])

    return ''


def _is_still_pending(apps, domain, reference_code):
    if not domain or not reference_code:
        return False

    model_map = {
        'spaces': ('spaces', 'SpaceBooking'),
        'media': ('media', 'MediaBooking'),
        'mess': ('mess', 'MessBooking'),
        'fleet': ('fleet', 'FleetBooking'),
    }
    app_label, model_name = model_map.get(domain, ('', ''))
    if not app_label:
        return False

    BookingModel = apps.get_model(app_label, model_name)
    return BookingModel.objects.filter(
        reference_code=reference_code,
        status='PENDING',
    ).exists()


def forwards(apps, schema_editor):
    Notification = apps.get_model('notifications', 'Notification')

    for notification in Notification.objects.all().only(
        'id',
        'category',
        'link',
        'is_read',
    ).iterator():
        domain = _domain_from_link(notification.link)
        reference_code = _reference_from_link(notification.link)
        is_actionable = (
            notification.category == 'BOOKING_PENDING'
            and _is_still_pending(apps, domain, reference_code)
        )

        Notification.objects.filter(id=notification.id).update(
            domain=domain,
            reference_code=reference_code,
            is_actionable=is_actionable,
        )


def backwards(apps, schema_editor):
    Notification = apps.get_model('notifications', 'Notification')
    Notification.objects.update(
        domain='',
        reference_code='',
        is_actionable=False,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
        ('spaces', '0014_remove_is_lab'),
        ('media', '0011_alter_mediabooking_status'),
        ('mess', '0008_alter_messbooking_status'),
        ('fleet', '0002_alter_fleetbooking_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='domain',
            field=models.CharField(blank=True, db_index=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='notification',
            name='is_actionable',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='notification',
            name='reference_code',
            field=models.CharField(blank=True, db_index=True, default='', max_length=64),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['recipient', 'is_actionable', '-created_at'], name='notificatio_recipie_dda12d_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['domain', 'reference_code', 'is_actionable'], name='notificatio_domain_604998_idx'),
        ),
        migrations.RunPython(forwards, backwards),
    ]
