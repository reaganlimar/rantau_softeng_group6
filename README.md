# RantaU

RantaU is a web app for people who recently moved cities and want to find relevant communities, events, and buddies.

## Current MVP

- Register and log in with basic validation.
- Edit profile details and keep them after refresh.
- Search and filter communities.
- Save communities, send join requests, cancel requests, and simulate acceptance.
- View notifications generated from actual app state.
- Join event RSVPs.
- Chat inside joined communities with saved messages.
- Change settings and reset app data.

## Agile Product Slice

This version focuses on the smallest usable journey:

1. A user creates or opens an account.
2. The user discovers communities matching their city and interests.
3. The user requests access and receives a status.
4. Once accepted, the user can chat and RSVP to an event.
5. The app stores progress locally so the journey survives refreshes.

The next iterations can add admin approval, richer community matching, and multi-user chat.

## Run Locally

Run the backend server:

```bash
npm start
```

Then visit:

```text
http://127.0.0.1:4173/index.html
```

The backend uses Node.js and stores app data in a SQLite database at `data/rantau.sqlite`.

## Backend API

- `POST /api/register` creates a user and saves the initial app state.
- `POST /api/login` verifies a user and returns their saved app state.
- `GET /api/state` loads the current user's saved state.
- `PUT /api/state` updates profile, communities, requests, settings, and chat data.
