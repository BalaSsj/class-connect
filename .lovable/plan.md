

# AI-Based Intelligent Faculty Reallocation System (AIRS)
## For Adhiyamaan College of Engineering, Dept. of CSE

---

## 1. Authentication & Role-Based Access

- **Three roles**: Admin, HOD, Faculty — stored in a secure `user_roles` table
- **Supabase Auth** with email/password login
- **OTP login option** for faculty (via Resend email service)
- Admin can auto-generate faculty credentials and send them via email
- Role-based route protection — each role sees only their dashboard

---

## 2. Admin Dashboard

- **Department Management**: Create/edit departments
- **Year & Section Management**: Add years (1st–4th) and sections (A, B, C, etc.)
- **Subject & Lab Management**: Create subjects and labs, mark lab-qualified faculty
- **Faculty Management**: Add faculty profiles with expertise, lab qualifications, and workload limits
- **Timetable Builder**: Assign 7 periods/day per section, drag-and-drop or form-based interface
- **Credential Management**: Auto-generate passwords, send login credentials via email
- **System Analytics**: Overview of faculty utilization, leave patterns, reallocation stats

---

## 3. HOD Dashboard

- **Department Overview**: See all faculty, their schedules, and current availability
- **Leave & OD Management**: View/approve/reject faculty leave and OD requests
- **Resigned Faculty Handling**: Mark faculty as resigned, trigger reallocation for their classes
- **AI Reallocation Trigger**: One-click to run reallocation when a faculty is unavailable
- **Override Capability**: Review AI suggestions, approve or manually override substitutions
- **Affected Classes View**: Instantly see which classes/labs are impacted by an absence

---

## 4. Faculty Dashboard

- **Personal Timetable**: Weekly view of assigned periods
- **Subject & Lab View**: See assigned subjects and labs
- **Leave/OD Application**: Submit leave or OD requests with date range and reason
- **Reallocation Notifications**: Get notified when assigned as a substitute
- **Digital Lab Manuals**: Access experiment procedures and lab resources (uploaded by admin)

---

## 5. AI-Powered Reallocation Engine

- **Rule-based scoring system** (not heavy ML) that evaluates substitutes by:
  - Subject expertise match
  - Lab qualification (for lab sessions)
  - Free period availability (no timetable conflicts)
  - Current workload (fairness — don't overload one faculty)
  - Continuity preference (same substitute for consecutive absences)
- **Conflict detection**: Ensures no double-booking
- **Batch reallocation**: Handle multi-day absences and resignations
- **HOD approval workflow**: AI suggests → HOD reviews → confirm or override

---

## 6. Timetable System

- 7 periods/day structure
- Separate timetables per year and section
- Lab sessions flagged distinctly from theory classes
- Visual weekly timetable grid for both faculty and section views

---

## 7. Email Notifications (via Resend)

- Faculty credential delivery on account creation
- OTP codes for faculty login
- Reallocation assignment notifications
- Leave/OD approval/rejection notifications

---

## 8. UI Design

- **Professional sidebar-based layout** using Shadcn sidebar component
- **Role-specific navigation**: Admin sees management tools, HOD sees department tools, Faculty sees personal tools
- **Clean, modern design** with cards, tables, and data visualizations
- **Responsive** for desktop and tablet use
- **Dashboard cards** with key metrics (active faculty, pending leaves, reallocations today)
- **Color-coded timetable** grids for easy readability

---

## 9. Database Structure (Lovable Cloud / Supabase)

Key tables:
- `departments`, `years_sections`, `subjects`, `labs`
- `faculty` (profiles with expertise, qualifications)
- `timetable_slots` (7 periods × days × sections)
- `leave_requests`, `od_requests`
- `reallocations` (AI-generated substitutions with status)
- `lab_manuals` (digital resources)
- `user_roles` (secure role management)
- `notifications`

---

## 10. Implementation Order

1. **Phase 1**: Auth system, role management, Admin dashboard (departments, faculty, subjects)
2. **Phase 2**: Timetable builder and viewer
3. **Phase 3**: Faculty dashboard, leave/OD requests
4. **Phase 4**: HOD dashboard, request management
5. **Phase 5**: AI reallocation engine and notification system
6. **Phase 6**: Email integration (Resend), analytics, polish

