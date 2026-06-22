from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta
from apps.users.models import CustomUser, Department, Role
from apps.mess.models import MessBooking
from apps.notifications.models import Notification

class MessAutoApprovalTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(department_name="Test Dept", department_code="TST")
        self.mess_manager_role, _ = Role.objects.get_or_create(name=Role.Name.MESS_MANAGER)

        self.user1 = CustomUser.objects.create_user(email="user1@rcss.edu", password="pw", department=self.department, employee_student_id="E1")
        self.user2 = CustomUser.objects.create_user(email="user2@rcss.edu", password="pw", department=self.department, employee_student_id="E2")

    def test_scenario_8_sole_mess_manager(self):
        """8. MESS: sole MESS_MANAGER books catering -> auto-approved."""
        self.user1.roles.add(self.mess_manager_role)
        
        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/api/mess/bookings/", {
            "start_date": (timezone.now() + timedelta(days=2)).date().isoformat(),
            "end_date": (timezone.now() + timedelta(days=2)).date().isoformat(),
            "delivery_location": "Main Hall",
            "purpose_of_programme": "Test Banquet",
            "daily_menus": [
                {
                    "date": (timezone.now() + timedelta(days=2)).date().isoformat(),
                    "total_persons": 10,
                    "veg_persons": 5,
                    "nonveg_persons": 5,
                    "lunch_time": "13:00:00",
                    "lunch_menu": "Standard Lunch"
                }
            ]
        }, format='json')
        if res.status_code != 201:
            print("MESS ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = MessBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'APPROVED')
        self.assertEqual(booking.resolved_by, self.user1)
        self.assertEqual(Notification.objects.filter(reference_code=booking.reference_code).count(), 0)

    def test_scenario_8_two_mess_managers(self):
        """8. MESS: two MESS_MANAGER users exist, one books -> stays PENDING, only the other is notified."""
        self.user1.roles.add(self.mess_manager_role)
        self.user2.roles.add(self.mess_manager_role)
        
        self.client.force_authenticate(user=self.user1)
        res = self.client.post("/api/mess/bookings/", {
            "start_date": (timezone.now() + timedelta(days=2)).date().isoformat(),
            "end_date": (timezone.now() + timedelta(days=2)).date().isoformat(),
            "delivery_location": "Main Hall",
            "purpose_of_programme": "Test Banquet",
            "daily_menus": [
                {
                    "date": (timezone.now() + timedelta(days=2)).date().isoformat(),
                    "total_persons": 10,
                    "veg_persons": 5,
                    "nonveg_persons": 5,
                    "lunch_time": "13:00:00",
                    "lunch_menu": "Standard Lunch"
                }
            ]
        }, format='json')
        booking = MessBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'PENDING')
        
        notifications = Notification.objects.filter(reference_code=booking.reference_code)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().recipient, self.user2)
