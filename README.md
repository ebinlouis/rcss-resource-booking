# RCSS Resource Booking System & College ERP

An enterprise-grade, role-based Resource Booking and ERP system built for Rajagiri College of Social Sciences. This system handles the scoped reservation and approval workflows for college spaces, computer labs, media equipment, fleet vehicles, and multi-day mess catering.

## 🚀 Key Features

* **Advanced Role-Based Access Control (RBAC):** Uses an additive Many-to-Many role system (replacing standard Django Groups) to allow users to hold multiple roles simultaneously (e.g., Faculty + Lab In-charge).
* **Scoped Approvals:** Approvers only see what they manage. Receptionists are scoped to specific blocks, Lab In-charges to specific labs, and the Principal has a global read/cancel overview.
* **Dynamic Multi-Day Catering:** Parent/Child database architecture allows users to book food for multi-day events with dynamic, customizable menus and headcounts for each specific day.
* **Smart Capacity Filtering:** React frontend dynamically filters available rooms based on requested attendee counts in real-time.
* **Temporary Role Overrides:** IT Admins can grant temporary, time-bound approval authority to staff (e.g., granting a Lab In-charge HOD approval rights while the HOD is on leave).

## 🛠️ Tech Stack

**Frontend**
* React.js (Vite)
* Tailwind CSS for styling
* React Router DOM

**Backend**
* Django & Django REST Framework (DRF)
* PostgreSQL (Database)
* Custom Data Migrations for seamless schema upgrades

---

## 💻 Getting Started (Local Development)

Follow these steps to get the project running on your local machine.

### Prerequisites
* Python 3.10+
* Node.js 18+
* PostgreSQL

### Backend Setup

1. **Navigate to the backend directory and activate your virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **⚠️ CRITICAL: Database Migrations**
   Because we use custom data migration scripts to preserve data integrity (specifically for the dynamic Mess module), **DO NOT RUN `makemigrations`** unless you are actively developing a new database model. 
   
   To sync your local database, strictly run:
   ```bash
   python manage.py migrate
   ```

4. **Start the development server:**
   ```bash
   python manage.py runserver
   ```
   The backend will be available at `http://localhost:8000`.

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

---

## 👥 User Roles & Workflows

* **Student / Faculty:** Can submit bookings and view their own history.
* **Block Receptionist:** Scoped to specific buildings. Approves/rejects standard space bookings in their assigned block.
* **Lab In-charge:** Scoped to specific computer labs. Approves/rejects seat-level bookings based on lab capacity and working hours.
* **Principal:** Has a global view of all *approved* space bookings. Bypasses the pending queue entirely and can instantly cancel conflicting bookings to reserve a space.
* **IT Admin:** Manages the system infrastructure, RBAC role assignments, and temporary role overrides.

## 🗄️ Database Architecture Notes

* **Auth User:** We use a `CustomUser` model overriding Django's default. Permissions are handled via an additive `roles = models.ManyToManyField(Role)` field, completely bypassing flat Django Groups.
* **Mess Bookings:** Split into `MessBooking` (Parent Event) and `DailyMessMenu` (Child Days) to allow per-day menu and headcount customization without data redundancy.
 
