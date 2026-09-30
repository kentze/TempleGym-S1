# TempleGym

A mobile app for Temple University students to log gym workouts, earn points, and compete on a weekly leaderboard.

**GitHub:** https://github.com/kentze/TempleGym  
**Team:** Destiny Baugh · Yixin Lu · Ken Tze  
**Course:** CIS 3296 — Software Design, Spring 2026

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Expo) + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL via Prisma ORM (hosted on Railway) |
| Auth | JWT + OTP email (Resend API) |
| Monorepo | npm workspaces |
| Testing | Jest + ts-jest |

---

## Repository Structure

```
TempleGym/
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── server/          # Express + Prisma backend
│       └── src/
│           ├── routes/        # auth, workouts, exercises, leaderboard, me
│           ├── services/      # jwt, otp, email, gps, points, leaderboard
│           ├── utils/         # haversine distance, week label
│           ├── jobs/          # leaderboard weekly reset cron
│           └── __tests__/     # Jest test suites
└── packages/
    └── types/           # Shared TypeScript types (@templegym/types)
```

---

## Setup

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database (or Railway connection string)
- Resend API key (for OTP emails)

### Install

```bash
# From TempleGym/ root
npm install
```

### Server environment variables

Create `apps/server/.env`:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-at-least-16-chars
JWT_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
OTP_EXPIRY_MINUTES=10
GYM_LAT=39.9812
GYM_LNG=-75.1502
GYM_RADIUS_M=100
PORT=3000
NODE_ENV=development
```

---

## Running the App

```bash
# Start backend (tsx watch)
npm run dev:server

# Start mobile Expo dev server
npm run dev:mobile

# iOS simulator (from apps/mobile/)
npm run ios

# Android emulator (from apps/mobile/)
npm run android
```

---

## Database

```bash
# From apps/server/
npm run db:generate    # Prisma client generation
npm run db:migrate     # Apply migrations
npm run db:seed        # Seed exercises
```

---

## Running Tests

```bash
# From apps/server/
npm run test
```

Runs all 6 test suites (38 tests) with coverage output:

| File | Coverage |
|------|----------|
| `gps.service.ts` | 100% |
| `jwt.service.ts` | 100% |
| `points.service.ts` | 100% |
| `haversine.ts` | 100% |
| `otp.service.ts` (pure functions) | ~56% |
| `weekLabel.ts` | ~60% |

Run a single test file:
```bash
npm run test -- --testPathPattern=haversine
npm run test -- --testPathPattern=points
npm run test -- --testPathPattern=jwt
npm run test -- --testPathPattern=gps
npm run test -- --testPathPattern=otp
```

---

## Key Features

- **OTP Authentication** — Temple email domain only (`tu#####@temple.edu`). 6-digit code expires in 10 minutes. Rate-limited to 3 requests per email per 10 minutes.
- **GPS Check-in** — Haversine distance check against configured gym coordinates. Verified sessions earn a +25 point bonus.
- **Workout Logging** — Push / Pull / Legs / Cardio / Full Body sessions. Tracks exercises, sets, weight (kg), and reps per set.
- **Points System** — Base 50 pts + duration bonus (10 pts / 10 min, capped at 150) + volume bonus (5 pts / 1000 kg lifted) + GPS bonus (25 pts).
- **Weekly Leaderboard** — Aggregated by ISO week (JST). Resets every Sunday at 23:59 JST via cron. Users can opt in to anonymous display.
- **Tier System** — Bronze → Silver → Gold → Platinum → Diamond → Masters → Champion based on weekly points.

---

## Architecture Overview

```
Mobile App (Expo)
    │  JWT (Bearer)
    ▼
Express Server
    ├── /auth/request-otp  → OTP generation + email
    ├── /auth/verify-otp   → OTP verify → JWT
    ├── /workouts          → Log session, GPS check, award points
    ├── /exercises         → Fetch exercise catalogue
    ├── /leaderboard       → Weekly rankings
    └── /me                → Current user profile
    │
    ▼
PostgreSQL (Prisma)
    ├── User
    ├── OtpRequest
    ├── WorkoutSession
    ├── WorkoutExercise
    └── ExerciseSet
```

---

## Type-checking

```bash
# From TempleGym/ root — checks all workspaces
npm run typecheck
```
