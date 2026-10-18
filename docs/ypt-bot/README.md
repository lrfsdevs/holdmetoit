# YPT Analytics Checker

A Node.js & Express service for querying YPT (Yeolpumta) study group analytics without running a timer.

## Features

- **CLI Interactive Authentication**: Prompts for your YPT account email and password when started.
- **Joined Groups Discovery**: Fetches all groups the account belongs to (`/group/groups/v2`) and displays them in a structured table.
- **Unified Single-Grid Member Leaderboard**: Automatically consolidates all members across all joined groups/channels into a single unified grid, deduplicating members who belong to multiple groups while preserving their highest study times, live status, and group memberships.
- **Search Within Joined Groups**: Filter joined groups by name, category, or ID via the Express REST API (`GET /groups?q=...`).
- **Unified Members API**: Query all deduplicated members across all groups/channels (`GET /members`).
- **Live Member Analytics**: Fetch real-time member study durations, ongoing status, and subjects for a specific group (`GET /groups/:groupId/members`).

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Server

```bash
npm start
```

When prompted in the terminal, enter your YPT dummy account credentials:

```text
=============================================
       YPT Analytics Server Login Setup
=============================================

Enter YPT Email: your-dummy-account@example.com
Enter YPT Password: yourpassword
```

_(Optional: You can also pass `YPT_EMAIL` and `YPT_PASSWORD` as environment variables for headless/containerized execution)._

---

## REST API Endpoints

| Method | Endpoint                   | Description                                                                                                                                  |
| :----- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/health`                  | Server status and authenticated account info.                                                                                                |
| `GET`  | `/members`                 | **Unified Members**: Consolidated and deduplicated members across all joined groups/channels. Supports `?q=<keyword>` and `?log=true`.       |
| `GET`  | `/groups`                  | List all joined groups.                                                                                                                      |
| `GET`  | `/groups?q=<keyword>`      | Search / filter joined groups by keyword (ID, name, category, owner).                                                                        |
| `GET`  | `/groups?refresh=true`     | Force refresh joined groups directly from YPT servers.                                                                                       |
| `GET`  | `/groups/:groupId`         | Get metadata for a specific joined group.                                                                                                    |
| `GET`  | `/groups/:groupId/members` | **Group Member Analytics**: Returns members of a specific group with live study status, today's accumulated study time, and active subjects. |

---

## Example Member Analytics Response

`GET http://localhost:3000/groups/6487271/members`

```json
{
   "success": true,
   "groupId": 6487271,
   "memberCount": 24,
   "members": [
      {
         "userId": 16300695,
         "nickname": "StudentA",
         "category": "College",
         "isStudying": true,
         "isPaused": false,
         "currentSubject": "Calculus",
         "todayStudyTime": "04:15:30",
         "liveStudyTime": "04:32:10",
         "studiconId": 105,
         "hasCustomAvatar": false,
         "avatarUrl": "https://alicdn.tgclab.com/sc.v2/105/normal1.png"
      }
   ]
}
```
