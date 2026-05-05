import concurrent.futures
from django.test import TransactionTestCase
from django.db import IntegrityError
from apps.users.models import CustomUser, Department
from apps.spaces.models import Space, SpaceBooking

class DoubleBookingConcurrencyTest(TransactionTestCase):
    """
    STRESS TEST: Proving the PostgreSQL ExclusionConstraint mathematically
    prevents double-booking at the exact same millisecond.
    """
    
    def setUp(self):
        # 1. Create a dummy department 
        self.department = Department.objects.create(
            department_name="Computer Applications",
            department_code="MCA"
        )

        # 2. Create a dummy user
        self.user = CustomUser.objects.create_user(
            email="stress_test@rcss.edu", 
            password="testpassword123",
            employee_student_id="MCA-2027-001" 
        )
        
        # 3. Create the Space we are going to try and double-book
        self.space = Space.objects.create(
            name="Advanced AI Lab", 
            space_type="LAB", 
            capacity_hard=60, 
            location="Main Block"
        )

    def test_concurrent_double_booking_lock(self):
        # To test the PostgreSQL lock, we bypass the API (which forces PENDING)
        # and smash the database directly with two simultaneous APPROVED records.
        
        def make_approved_booking():
            return SpaceBooking.objects.create(
                user=self.user,
                department=self.department,
                space=self.space,
                attendee_count=15,
                purpose_of_booking="DB Lock Test",
                start_datetime="2026-10-15T10:00:00Z",
                end_datetime="2026-10-15T12:00:00Z",
                status="APPROVED" # <--- THIS is what triggers the PostgreSQL lock
            )

        # Fire 2 database writes at the exact same time
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(make_approved_booking) for _ in range(2)]

            success_count = 0
            error_caught = False

            for future in concurrent.futures.as_completed(futures):
                try:
                    future.result() # If it saves successfully, count goes up
                    success_count += 1
                except IntegrityError:
                    # PostgreSQL slams the door on the second thread!
                    error_caught = True

        # THE ASSERTIONS (This proves Phase 1 is a success)
        
        # 1. Exactly ONE booking should have won the race and been saved
        self.assertEqual(success_count, 1)
        
        # 2. We MUST have caught an IntegrityError from Postgres for the loser
        self.assertTrue(error_caught)
        
        # 3. Double check the database table actually only has 1 record
        self.assertEqual(SpaceBooking.objects.count(), 1)
        
        print("\n✅ DATABASE LOCK VERIFIED! PostgreSQL successfully blocked the overlapping APPROVED booking.")