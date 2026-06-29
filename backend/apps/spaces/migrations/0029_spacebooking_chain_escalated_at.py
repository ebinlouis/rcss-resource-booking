from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("spaces", "0028_alter_spacebooking_faculty_timed_out"),
    ]

    operations = [
        migrations.AddField(
            model_name="spacebooking",
            name="chain_escalated_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text=(
                    "Set when the fallback approver is notified via the HOD_FALLBACK "
                    "chain escalation. Null means escalation has not yet fired."
                ),
            ),
        ),
    ]
