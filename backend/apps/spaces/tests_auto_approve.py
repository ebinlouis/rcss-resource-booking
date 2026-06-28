from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta
from apps.users.models import CustomUser, Department, Role
from apps.spaces.models import Space, SpaceBooking, SpaceApprover, SpaceApproverChain
from apps.notifications.models import Notification

class SpacesAutoApprovalTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(department_name="Test Dept", department_code="TST")
        
        # Roles
        self.receptionist_role, _ = Role.objects.get_or_create(name=Role.Name.RECEPTIONIST)
        self.hod_role, _ = Role.objects.get_or_create(name=Role.Name.HOD)
        self.student_role, _ = Role.objects.get_or_create(name=Role.Name.STUDENT)
        self.faculty_role, _ = Role.objects.get_or_create(name=Role.Name.FACULTY)

        # Users
        self.user1 = CustomUser.objects.create_user(email="user1@rcss.edu", password="pw", department=self.department, employee_student_id="E1")
        self.user2 = CustomUser.objects.create_user(email="user2@rcss.edu", password="pw", department=self.department, employee_student_id="E2")
        self.user3 = CustomUser.objects.create_user(email="user3@rcss.edu", password="pw", department=self.department, employee_student_id="E3")
        self.student = CustomUser.objects.create_user(email="student@rcss.edu", password="pw", department=self.department, employee_student_id="E4")
        self.student.roles.add(self.student_role)
        self.faculty = CustomUser.objects.create_user(email="faculty@rcss.edu", password="pw", department=self.department, employee_student_id="E5")
        self.faculty.roles.add(self.faculty_role)

        # Direct Workflow Space
        self.space_direct = Space.objects.create(name="Direct Space", space_type="OTHER", capacity_hard=10, approval_workflow_type="DIRECT", approval_category="OTHER")
        
        # HOD Fallback Space
        self.space_chain = Space.objects.create(name="Chain Space", space_type="LAB", capacity_hard=10, approval_workflow_type="HOD_FALLBACK", approval_category="LAB")

    def test_scenario_1_direct_sole_approver(self):
        """1. SPACES, DIRECT, sole approver: one RECEPTIONIST books -> auto-approved."""
        SpaceApprover.objects.create(user=self.user1, space=self.space_direct, role=self.receptionist_role, scope_type="SPACE") # sole approver
        self.user1.roles.add(self.receptionist_role)
        
        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/api/spaces/requests/", {
            "space": self.space_direct.id,
            "start_datetime": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "attendee_count": 5,
            "purpose_of_booking_input": "Test"
        })
        if res.status_code != 201:
            print("SPACES 1 ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = SpaceBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'APPROVED')
        self.assertEqual(booking.resolved_by, self.user1)
        self.assertEqual(Notification.objects.filter(reference_code=booking.reference_code, is_actionable=True).count(), 0)
        self.assertEqual(Notification.objects.filter(reference_code=booking.reference_code, is_actionable=False).count(), 0)

    def test_scenario_2_direct_two_approvers(self):
        """2. SPACES, DIRECT, two approvers: two RECEPTIONISTs exist, one books -> stays PENDING, the OTHER approver gets notification."""
        SpaceApprover.objects.create(user=self.user1, space=self.space_direct, role=self.receptionist_role, scope_type="SPACE")
        SpaceApprover.objects.create(user=self.user2, space=self.space_direct, role=self.receptionist_role, scope_type="SPACE")
        self.user1.roles.add(self.receptionist_role)
        self.user2.roles.add(self.receptionist_role)
        
        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/api/spaces/requests/", {
            "space": self.space_direct.id,
            "start_datetime": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "attendee_count": 5,
            "purpose_of_booking_input": "Test"
        })
        if res.status_code != 201:
            print("SPACES 2 ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = SpaceBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'PENDING')
        
        # Check notifications
        notifications = Notification.objects.filter(reference_code=booking.reference_code)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().recipient, self.user2)
        self.assertTrue(notifications.first().is_actionable)

    def test_scenario_3_hod_chain_primary_books(self):
        """3. SPACES, HOD_FALLBACK with chain: primary_approver books, fallback_approver is a different user -> auto-approved, fallback_approver receives exactly one notification with is_actionable=False."""
        SpaceApproverChain.objects.create(space=self.space_chain, primary_approver=self.user1, fallback_approver=self.user2)
        
        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/api/spaces/requests/", {
            "space": self.space_chain.id,
            "start_datetime": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "attendee_count": 5,
            "purpose_of_booking_input": "Test"
        })
        if res.status_code != 201:
            print("SPACES 3 ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = SpaceBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'APPROVED')
        
        notifications = Notification.objects.filter(reference_code=booking.reference_code)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().recipient, self.user2)
        self.assertFalse(notifications.first().is_actionable)

    def test_scenario_4_hod_chain_primary_is_fallback(self):
        """4. SPACES, HOD_FALLBACK with chain: primary_approver_id == fallback_approver_id (same user is both) and that user books -> auto-approved, no informational notification sent to anyone."""
        SpaceApproverChain.objects.create(space=self.space_chain, primary_approver=self.user1, fallback_approver=self.user1)
        
        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/api/spaces/requests/", {
            "space": self.space_chain.id,
            "start_datetime": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "attendee_count": 5,
            "purpose_of_booking_input": "Test"
        })
        if res.status_code != 201:
            print("SPACES 4 ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = SpaceBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'APPROVED')
        
        notifications = Notification.objects.filter(reference_code=booking.reference_code)
        self.assertEqual(notifications.count(), 0)

    def test_scenario_5_hod_chain_fallback_books(self):
        """5. SPACES, HOD_FALLBACK with chain: fallback_approver books, primary_approver is a different user -> stays PENDING, primary_approver gets the normal actionable notification."""
        SpaceApproverChain.objects.create(space=self.space_chain, primary_approver=self.user1, fallback_approver=self.user2)
        
        self.client.force_authenticate(user=self.user2)
        res = self.client.post("/api/spaces/requests/", {
            "space": self.space_chain.id,
            "start_datetime": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "attendee_count": 5,
            "purpose_of_booking_input": "Test"
        })
        if res.status_code != 201:
            print("SPACES 5 ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = SpaceBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'PENDING')
        
        notifications = Notification.objects.filter(reference_code=booking.reference_code)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().recipient, self.user1)
        self.assertTrue(notifications.first().is_actionable)

    def test_scenario_6_non_cs_dept_hod_fallback_gated_from_lab_incharge(self):
        """6. HOD_FALLBACK is department-agnostic: a booking from an English (non-CS) department
        user on a HOD_FALLBACK space must be invisible to LAB_INCHARGE within the fallback window,
        exactly as a CS-department booking would be.
        Regression test: _is_cs_department was a bug; _uses_hod_fallback_workflow(booking.space)
        is the correct guard, requiring no department check at all.
        """
        from django.test.utils import override_settings

        english_dept = Department.objects.create(department_name="English", department_code="ENG")
        lab_incharge_role, _ = Role.objects.get_or_create(name=Role.Name.LAB_INCHARGE)

        # Lab incharge assigned to the HOD_FALLBACK space
        lab_user = CustomUser.objects.create_user(
            email="lab@rcss.edu", password="pw",
            department=self.department, employee_student_id="LAB1"
        )
        lab_user.roles.add(lab_incharge_role)
        SpaceApprover.objects.create(
            user=lab_user, space=self.space_chain,
            role=lab_incharge_role, scope_type="SPACE"
        )

        # Requester is from English department (non-CS)
        english_user = CustomUser.objects.create_user(
            email="eng_user@rcss.edu", password="pw",
            department=english_dept, employee_student_id="ENG1"
        )

        # Create a PENDING booking on the HOD_FALLBACK space directly (not via API
        # so we control created_at to be within the fallback window)
        booking = SpaceBooking.objects.create(
            user=english_user,
            space=self.space_chain,
            start_datetime=timezone.now() + timedelta(days=1),
            end_datetime=timezone.now() + timedelta(days=1, hours=1),
            attendee_count=5,
            purpose_of_booking="English dept test",
            status="PENDING",
        )

        # Within the 24-hour fallback window: lab_incharge must NOT be able to resolve
        with override_settings(HOD_FALLBACK_LAB_EXCLUSION_HOURS=24):
            from apps.approvals.views import _matches_space_approver_assignment
            assignment = SpaceApprover.objects.get(user=lab_user, space=self.space_chain)
            # Reload to pick up the role relation
            assignment = SpaceApprover.objects.select_related("role").get(pk=assignment.pk)
            result = _matches_space_approver_assignment(booking, assignment)
            self.assertFalse(
                result,
                "LAB_INCHARGE should be blocked from a HOD_FALLBACK booking within the "
                "fallback window, regardless of the booker's department (English, not CS)."
            )

    def test_scenario_6b_non_cs_dept_hod_fallback_chain_behavior_identical(self):
        """6b. HOD_FALLBACK with a real SpaceApproverChain on a non-CS department space:
        primary_approver books -> auto-approved, fallback_approver receives informational
        notification. Proves chain-based auto-approval is department-agnostic -- it operates
        on chain.primary_approver/fallback_approver directly with no department check.
        """
        physics_dept = Department.objects.create(department_name="Physics", department_code="PHY")
        physics_space = Space.objects.create(
            name="Physics Lab", space_type="LAB", capacity_hard=20,
            approval_workflow_type="HOD_FALLBACK", approval_category="LAB"
        )

        primary = CustomUser.objects.create_user(
            email="physics_primary@rcss.edu", password="pw",
            department=physics_dept, employee_student_id="PHY1"
        )
        fallback = CustomUser.objects.create_user(
            email="physics_fallback@rcss.edu", password="pw",
            department=physics_dept, employee_student_id="PHY2"
        )
        SpaceApproverChain.objects.create(
            space=physics_space, primary_approver=primary, fallback_approver=fallback
        )

        self.client.force_authenticate(user=primary)
        res = self.client.post("/api/spaces/requests/", {
            "space": physics_space.id,
            "start_datetime": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "attendee_count": 5,
            "purpose_of_booking_input": "Physics dept test"
        })
        if res.status_code != 201:
            print("SPACES 6b ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = SpaceBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'APPROVED')

        # fallback gets exactly one informational (non-actionable) notification
        notifications = Notification.objects.filter(reference_code=booking.reference_code)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().recipient, fallback)
        self.assertFalse(notifications.first().is_actionable)

    def test_scenario_7_awaiting_faculty_unaffected(self):
        """7. Confirm an AWAITING_FACULTY booking (student with faculty_sponsor, non-HOD_FALLBACK space) is completely unaffected -> goes to AWAITING_FACULTY."""
        self.client.force_authenticate(user=self.student)
        res = self.client.post("/api/spaces/requests/", {
            "space": self.space_direct.id,
            "start_datetime": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "attendee_count": 5,
            "purpose_of_booking_input": "Test",
            "faculty_sponsor": self.faculty.id
        })
        if res.status_code != 201:
            print("SPACES 7 ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = SpaceBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'AWAITING_FACULTY')
        
        # Check that no regular notification to space approvers went out yet
        notifications = Notification.objects.filter(reference_code=booking.reference_code)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().recipient, self.faculty) # Only the faculty sponsor should be notified
