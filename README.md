# Crewdesk

Admin and employee sign-in/registration with Node.js, Express, MongoDB (Mongoose) and EJS.

## Run it

```bash
npm install
cp .env.example .env     # then edit the values
npm run dev
```

Open http://localhost:3000

## How it works

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
middleware/auth.js   guestOnly, requireAuth, requireRole
routes/              auth, admin, employee
views/               EJS pages and partials
public/              css and js
```
