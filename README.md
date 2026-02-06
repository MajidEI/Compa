# Compara

A full-stack application for comparing Salesforce Profiles and Permission Sets side-by-side, designed for security audits and compliance reviews.

![Compara](https://img.shields.io/badge/Salesforce-Compara-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Developer

**Abdel Majid Ed-dahbi**

## Features

- **OAuth 2.0 Authentication**: Secure login via Salesforce Web Server Flow (Production & Sandbox)
- **Profile & Permission Set Selection**: Browse and select multiple profiles and/or permission sets to compare
- **Comprehensive Comparison**: Compare all permission types:
  - Object Permissions (CRUD, View All, Modify All)
  - Field-Level Security (Read/Edit per field)
  - System Permissions (User Permissions)
  - Apex Class Access
  - Visualforce Page Access
  - Lightning Page Access
  - Record Type Access
  - Tab Visibility (DefaultOn, DefaultOff, Hidden)
  - App Visibility (Visible, Default)
- **Diff Highlighting**: Visual indicators for added, removed, and changed permissions
- **Filtering**: Show only differences, filter by category, search by name
- **Tree-Based UI**: Hierarchical view organized by category and object
- **Export Options**:
  - CSV (Differences Only, Detailed, Summary)
  - JSON (Full data export)
- **Comparison History**: Automatically saves comparisons for later review

## Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **APIs**: Salesforce REST API, Tooling API
- **Auth**: Salesforce OAuth 2.0 (Web Server Flow)

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Project Structure

```
Profilecomp/
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration management
│   │   ├── routes/           # Express route handlers
│   │   │   ├── auth.routes.ts
│   │   │   └── profiles.routes.ts
│   │   ├── services/         # Business logic
│   │   │   ├── salesforce.service.ts  # Salesforce API client
│   │   │   ├── normalizer.service.ts  # Data normalization
│   │   │   └── diff.service.ts        # Diff engine
│   │   ├── types/            # TypeScript type definitions
│   │   └── index.ts          # Entry point
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── Header.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── ProfileSelector.tsx
│   │   │   ├── ComparisonView.tsx
│   │   │   ├── ComparisonSummary.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── services/         # API client
│   │   ├── types/            # TypeScript types
│   │   ├── App.tsx           # Main component
│   │   └── main.tsx          # Entry point
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- A Salesforce org (Developer, Sandbox, or Production)
- A Salesforce Connected App configured for OAuth

### 1. Create a Salesforce Connected App

1. Go to **Setup** > **App Manager** > **New Connected App**
2. Fill in the basic information:
   - Connected App Name: `Profile Compare`
   - API Name: `Profile_Compare`
   - Contact Email: Your email
3. Enable OAuth Settings:
   - Callback URL: `http://localhost:3001/auth/callback`
   - Selected OAuth Scopes:
     - `Access and manage your data (api)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`
4. Save and wait for the app to be created (can take 2-10 minutes)
5. Copy the **Consumer Key** and **Consumer Secret**

### 2. Configure the Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your Connected App credentials
# SF_CLIENT_ID=your_consumer_key
# SF_CLIENT_SECRET=your_consumer_secret
```

### 3. Configure the Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

### 4. Run the Application

```bash
# Terminal 1: Start the backend (from backend directory)
npm run dev

# Terminal 2: Start the frontend (from frontend directory)
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/login` | Redirects to Salesforce OAuth |
| GET | `/auth/callback` | OAuth callback handler |
| GET | `/auth/status` | Check authentication status |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Clear session and logout |

### Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profiles` | List all profiles |
| GET | `/profiles/:id` | Get single profile details |
| POST | `/profiles/compare` | Compare selected profiles |

### Example Request: Compare Profiles

```bash
POST /profiles/compare
Content-Type: application/json

{
  "profileIds": ["00e000000000001AAA", "00e000000000002AAA"]
}
```

### Example Response

```json
{
  "comparison": {
    "profiles": [
      { "id": "00e000000000001AAA", "name": "Standard User" },
      { "id": "00e000000000002AAA", "name": "System Administrator" }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z",
    "totalDifferences": 156,
    "differences": [
      {
        "path": "objects.Account.permissions.delete",
        "category": "objectPermission",
        "objectName": "Account",
        "permissionName": "delete",
        "values": {
          "00e000000000001AAA": false,
          "00e000000000002AAA": true
        },
        "diffType": "changed"
      }
    ],
    "summary": {
      "objectPermissions": 45,
      "fieldPermissions": 89,
      "systemPermissions": 12,
      "apexClasses": 5,
      "visualforcePages": 3,
      "lightningPages": 2,
      "recordTypes": 0,
      "tabVisibilities": 0,
      "appVisibilities": 0
    }
  },
  "profiles": [
    {
      "profileId": "00e000000000001AAA",
      "profileName": "Standard User",
      "objects": { ... },
      "systemPermissions": { ... },
      "apexClasses": [ ... ]
    }
  ]
}
```

## Data Model

### NormalizedProfile

```typescript
{
  profileId: string;
  profileName: string;
  objects: {
    [objectName: string]: {
      permissions: {
        read: boolean;
        create: boolean;
        edit: boolean;
        delete: boolean;
        viewAll: boolean;
        modifyAll: boolean;
      };
      fields: {
        [fieldName: string]: {
          read: boolean;
          edit: boolean;
        }
      }
    }
  };
  systemPermissions: { [permissionName: string]: boolean };
  apexClasses: string[];
  visualforcePages: string[];
  lightningPages: string[];
  recordTypes: string[];
  tabVisibilities: { [tabName: string]: string };
  appVisibilities: { [appName: string]: { visible: boolean; default: boolean } };
}
```

## Handling Large Orgs

The application is designed to handle large Salesforce orgs efficiently:

1. **Batched Queries**: Uses SOQL `IN` clauses to batch profile queries
2. **Automatic Pagination**: Handles Salesforce's 2000 record query limit
3. **Parallel Fetching**: Fetches different permission types in parallel
4. **Lazy Loading**: UI components load data as needed

## Features Completed

- [x] **Tab Visibility**: Full implementation via Profile Metadata API
- [x] **App Visibility**: Full implementation via Profile Metadata API
- [x] **Lightning Pages**: FlexiPage access tracking
- [x] **Export to CSV/Excel**: Export differences, detailed data, or summary
- [x] **Export to JSON**: Full data export for developers
- [x] **Comparison History**: Save and revisit previous comparisons
- [x] **Permission Set Comparison**: Compare Permission Sets alongside Profiles

## Known Limitations & Future TODOs

- [ ] **Record Type Access**: Partial implementation via SetupEntityAccess
- [ ] **Profile Cloning**: Suggest changes to make profiles match
- [ ] **Permission Set Groups**: Support for comparing PSGs
- [ ] **Real-time Collaboration**: Share comparisons with team members

## Security Considerations

- OAuth tokens are stored in server-side sessions only
- Refresh tokens are used to maintain long-lived sessions
- CORS is configured to only allow the frontend origin
- All API routes require authentication
- No profile data is persisted on the server

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details
