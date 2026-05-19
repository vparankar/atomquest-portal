# AtomQuest Goal Setting & Tracking Portal

> **Submission for AtomQuest Hackathon 1.0**

A fully functional, web-based Goal Setting & Tracking Portal designed to eliminate fragmented spreadsheet-based goal management. The system supports the entire lifecycle of employee goals—from creation and alignment to quarterly check-ins and performance visibility—with a modern, responsive, and intuitive interface.

## 🌟 Key Features

### Phase 1: Goal Creation & Approval
- **Structured Goal Sheets:** Employees can create goals aligned with key Thrust Areas (Revenue, Cost, Customer, People, Process, Quality).
- **Flexible UoM:** Supports Numeric (Minimize/Maximize), Timeline, and Zero-based success metrics.
- **Strict Validation:** Enforces exactly 100% total weightage, a minimum of 10% per goal, and a maximum of 8 goals per employee.
- **Manager Approval Workflow:** L1 Managers can review, edit inline, or return goals for rework with comments. Once approved, goals are locked securely.
- **Shared Goals KPI:** Admins can push departmental KPIs (Shared Goals) down to multiple employees simultaneously.

### Phase 2: Achievement Tracking & Quarterly Check-ins
- **Quarterly Check-ins:** Structured check-in windows (Q1, Q2, Q3, Q4) strictly enforced by active cycle configurations.
- **Auto-computed Scores:** System computes performance scores based on the UoM formula (without generating ratings).
- **Manager Feedback:** Managers review quarterly achievements and log structured feedback/comments.

### Governance & Reporting (Bonus Features included!)
- **Analytics Dashboard (Bonus!):** High-level visual dashboard featuring QoQ trends, Goal Distribution, Department Completion Heatmaps, and Manager Effectiveness charts.
- **Exportable Reports:** One-click Excel/CSV export of Planned vs. Actual achievement data across the organization.
- **Completion Dashboard:** Real-time visibility into which employees and managers have finalized their check-ins.
- **Audit Trails:** Comprehensive logging of all critical actions (approvals, unlocks, system changes) with actor attribution.
- **Mock Integrations (Bonus!):** Demonstrates architectural readiness for Microsoft Teams and Email notifications via the settings panel.

---

## 🏗 Architecture & Tech Stack

![Architecture Diagram](architecture.md)
*(For full architecture details, refer to the included `architecture.md` file).*

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 + Lucide Icons + Recharts (for analytics)
- **Backend/Database:** Supabase (PostgreSQL + Auth + Auto-generated REST API)
- **Routing:** React Router v7

## 🚀 Getting Started (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory and add your Supabase credentials (you will need a Supabase project set up with the corresponding database schema):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run the Development Server
```bash
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## 🔐 Demo Accounts

The database comes pre-seeded with three demo accounts to evaluate the distinct role journeys. 
*(Note: Use these credentials to test the complete lifecycle without having to register new users).*

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin / HR** | `admin@test.com` | `admin` |
| **Manager (L1)** | `manager@test.com` | `manager` |
| **Employee** | `employee@test.com` | `employee` |

> **Pro Tip for Evaluators:** Log in as the **Admin** first and navigate to `System Settings` -> `Seed Demo Data` to auto-generate cycles, realistic employees, historical goal sheets, and quarterly achievements to instantly populate the Analytics Dashboard!

---

## 📋 Evaluation Checklist Met

- [x] **Functionality:** End-to-end flow is fully operational.
- [x] **Adherence to BRD:** All Phase 1 & Phase 2 constraints (weightages, limits, deadlines) are strictly enforced.
- [x] **User Friendliness:** Modern, cohesive Atomberg-inspired design language with clear empty states and error handling.
- [x] **Cost Optimization:** Leverages Supabase joined queries and static hosting capabilities to remain ultra-efficient.
- [x] **Good-To-Have Features:** Includes the **Analytics Module** (5.4) and **Mock Teams/Email hooks** (5.2). 
