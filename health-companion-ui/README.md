# Health Companion UI

Professional Next.js frontend for the Health Companion telehealth project.

## Features

- Next.js Pages Router with TypeScript
- Light healthcare design system with Tailwind CSS and shadcn/ui
- Auth session persistence with protected dashboard routes
- AI health chatbot with backend chat history
- Doctor appointment booking
- Health records management
- Backend API integration through `NEXT_PUBLIC_API_URL`

## Tech Stack

- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui and Radix UI
- TanStack Query
- Vitest

## Run Locally

Start the backend API from `../health-companion-backend`:

```bash
npm run dev
```

Start the frontend:

```bash
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

Backend URL:

```text
http://localhost:3001
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
```

## Environment

Create `.env` with:

```text
NEXT_PUBLIC_API_URL=http://localhost:3001
```
