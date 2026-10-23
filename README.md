# Crewdesk

Admin and employee sign-in/registration with Node.js, Express, MongoDB (Mongoose) and EJS.

## Run it

```bash
npm install
cp .env.example .env     # then edit the values
npm run dev
```

Open http://localhost:3000

## Task workflow

1. **Admin** uploads a task (image, optional instructions and due date) under *New task*.
2. **Employees** see it under *Available*, open it and press *Pick this task*. Only one employee can claim a task.
3. The employee submits their finished image plus **hashtags** and **keywords** (and an optional note).
4. **Admin** reviews on the task page and chooses **Approve**, **Ask for redo** or **Reject**. Redo and reject need written feedback.
5. After a redo the employee sees the feedback at the top of the task and submits a new attempt. Every attempt and verdict is kept in the history.

## Calendar

Both sides have a **Calendar** tab (month view, Monday first). Each task adds events on the day they happen:
uploaded, due, picked up, submitted (one per attempt), and approved / redo asked / rejected.
Click a day to see its events and jump to the task. Click a colour in the legend to hide that type.
Open tasks past their due date show as **Overdue**.

- Admins see every task, with the employee's name on pick-up, submission and review events.
- Employees see due dates for open tasks, plus every date for the tasks they picked up.
- Dates show in the viewer's own timezone. Due dates are whole days and never shift.

Uploads are stored in `uploads/` (JPG, PNG, WebP, GIF, max 5 MB), checked by file contents, and only served to signed-in users.

## How accounts work

- **Employees** register freely. **Admins** must enter `ADMIN_INVITE_CODE` from `.env`.
- Sign-in has an Employee / Admin switch; an account can only sign in on its own side.
- Admins see a roster where they can deactivate, reactivate or remove people.
- Deactivated or removed accounts lose access on their next request.

## Security included

bcrypt (cost 12), session cookies (httpOnly, sameSite=lax, secure in production) stored in MongoDB,
session regeneration on sign-in, CSRF tokens on every POST, rate limiting on login/register,
Helmet CSP headers, and server-side role checks on every protected route.

## Structure

```
server.js            app setup, sessions, CSRF
models/User.js       user schema
models/Task.js       task + submissions + reviews
lib/                 upload handling, tag parsing, status labels
middleware/auth.js   guestOnly, requireAuth, requireRole
routes/              auth, admin, employee, files
public/js/calendar.js  month calendar (fetches /admin|employee/calendar/events)
views/               EJS pages and partials
public/              css and js
```
