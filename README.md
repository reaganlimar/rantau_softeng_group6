# RantaU

RantaU is a web app for people who recently moved cities and want to find relevant communities, events, and buddies.

## Current MVP

- Register and log in with basic validation.
- Edit profile details and keep them after refresh.
- Search and filter communities, with a quick-preview popup before committing.
- Create communities, and request to join ones you don't own.
- Community owners review and accept or decline incoming join requests.
- View notifications generated from actual app state, including pending requests on both sides.
- Join event RSVPs.
- Chat inside joined communities with saved messages.
- Change settings and reset app data.

## Agile Product Slice

This version focuses on the smallest usable journey:

1. A user creates or opens an account.
2. The user discovers communities matching their city and interests, and can preview one before deciding.
3. The user requests to join a community; the owner accepts or declines.
4. Once accepted, the user can chat with other members in that community and RSVP to an event.
5. The app stores progress, including join requests, in the backend database.

The next iterations can add richer community matching and multi-admin moderation.

## Run Locally

Run the backend server:

```bash
npm start
```

Then visit:

```text
http://127.0.0.1:4173/index.html
```

The backend uses Node.js and stores app data in a SQLite database at `data/rantau.sqlite`. This file is gitignored and created automatically on first boot, so don't commit it.

For deployment, use a Node.js hosting platform and enable persistent storage for the `data/` folder so the SQLite database is not reset.

## Backend API

- `POST /api/register` creates a user and saves the initial app state.
- `POST /api/login` verifies a user and returns their saved app state.
- `GET /api/state` loads the current user's saved state, communities, their own join requests, and any incoming requests for communities they own.
- `PUT /api/state` updates profile, communities, settings, and chat data, and returns the latest requests.
- `GET /api/communities` loads shared communities.
- `POST /api/communities` creates a shared community.
- `POST /api/requests` sends a request to join a community.
- `DELETE /api/requests` cancels your own pending request (or leaves a community you've joined).
- `GET /api/requests/incoming` loads pending requests for communities you own.
- `POST /api/requests/respond` accepts or declines a pending request (owner only).
- `GET /api/messages` loads shared chat messages.
- `POST /api/messages` saves a shared chat message.
- `GET /api/members` loads visible members of a community.

