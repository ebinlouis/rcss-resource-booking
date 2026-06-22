from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta
from apps.users.models import CustomUser, Department, Role
from apps.fleet.models import Vehicle, FleetBooking
from apps.notifications.models import Notification

class FleetAutoApprovalTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(department_name="Test Dept", department_code="TST")
        
        self.fleet_manager_role, _ = Role.objects.get_or_create(name=Role.Name.FLEET_MANAGER)

        self.user1 = CustomUser.objects.create_user(email="user1@rcss.edu", password="pw", department=self.department, employee_student_id="E1")
        self.user2 = CustomUser.objects.create_user(email="user2@rcss.edu", password="pw", department=self.department, employee_student_id="E2")

        self.vehicle = Vehicle.objects.create(name="Test Van", capacity=10, is_active=True)

    def test_scenario_6_sole_fleet_manager(self):
        """6. FLEET: sole FLEET_MANAGER books a vehicle -> auto-approved."""
        self.user1.roles.add(self.fleet_manager_role)
        
        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/api/fleet/bookings/", {
            "vehicle": self.vehicle.id,
            "start_datetime": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "purpose": "Test",
            "destination": "Test",
            "pickup_location": "Test",
            "total_passengers": 5
        })
        if res.status_code != 201:
            print("FLEET ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = FleetBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'APPROVED')
        self.assertEqual(booking.resolved_by, self.user1)
        self.assertEqual(Notification.objects.filter(reference_code=booking.reference_code).count(), 0)

    def test_scenario_6_two_fleet_managers(self):
        """6. FLEET: two FLEET_MANAGER users exist, one books -> stays PENDING, only the other is notified."""
        self.user1.roles.add(self.fleet_manager_role)
        self.user2.roles.add(self.fleet_manager_role)
        
        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/api/fleet/bookings/", {
            "vehicle": self.vehicle.id,
            "start_datetime": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_datetime": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "purpose": "Test",
            "destination": "Test",
            "pickup_location": "Test",
            "total_passengers": 5
        })
        booking = FleetBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'PENDING')
        
        notifications = Notification.objects.filter(reference_code=booking.reference_code)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().recipient, self.user2)
