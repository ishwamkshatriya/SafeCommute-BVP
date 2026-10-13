# SafeCommute BVP

A college-community ride-matching MVP for Bharati Vidyapeeth students.

## Features
- PRN-based student login
- Initial password generated from surname in uppercase; change required on first login
- Admin CSV roster import/update
- Driver rides and rider requests
- Destination/date/time-window matching
- Seat requests and driver acceptance
- In-app chat for the driver and accepted riders
- Trip status management, ratings endpoint, reporting and blocking endpoints
- Admin student verification/report overview
- Outbound travel options for BlaBlaCar, Uber, Ola and Rapido
- Optional BlaBlaCar partner API adapter; without authorized access the app provides a search link rather than fabricated live results

## Run the whole project with one command
Requirements: Node.js 20.19+ and npm.

From the `SafeCommute-BVP` root folder:

```bash
npm install
npm run dev
```

This starts:
- API: `http://localhost:5000`
- Frontend: `http://localhost:5173`

Open **http://localhost:5173/** in your browser. The API root at `http://localhost:5000/` is not a web page and may show `Cannot GET /`. To check the API, open `http://localhost:5000/api/health`.

### Run separately if needed
Terminal 1:
```bash
cd server
npm install
npm run dev
```
Terminal 2:
```bash
cd client
npm install
npm run dev
```

## Demo accounts
- Admin: `ADMIN0001` / `Admin123!`
- Sample student: `2314110686` / `KSHATRIYA`
- Sample driver: `2314110653` / `GODBOLE`

Initial student passwords must be changed after first login. These are demo credentials only.

## Student roster
The project bundles `server/data/students-roster.csv`, containing 58 screenshot-derived records where both PRN and name were visible. On server startup, missing PRNs in this roster are added to the JSON database. Initial passwords are the final word of the name, uppercased. Branch is set to **Computer Science and Business Systems** from the screenshot. Semester was not visible and is marked `Not provided`.

The second screenshot displays names but not visible PRNs, so those rows are not login accounts yet. Contact numbers and personal email addresses were intentionally not imported.

CSV columns for later additions:
`PRN,Name,Surname,Branch,Semester`

The Admin panel can import a CSV. New PRNs receive a temporary surname-based password and must change it on first login. Re-importing an existing PRN updates profile metadata but does not reset the chosen password. Keep roster files private.

## Environment and storage
- The MVP uses a local JSON database at `server/data/db.json` to run without MongoDB.
- Optional environment variables are documented in `server/.env.example`.
- Do not commit `.env`, the generated database, or private roster files to a public repository.
- For a real college deployment, replace demo identity assumptions with an approved student verification process, use HTTPS, rate limits, audit logs, backups, and a managed database.

## API integration limitations
This project does not scrape BlaBlaCar. Live inventory requires authorized API access and a supported product/region. Uber, Ola and Rapido links hand off to their services; live fares and availability are not provided by those providers to this app unless separate partner access is granted.

## Scope and safety
Payments are not handled in the platform; riders and drivers arrange cost-sharing themselves. College-community matching is not a guarantee of safety. Confirm ride details, use sensible precautions, and report concerns to the administrator.


## Publish to GitHub
1. Create a new **private** repository on GitHub (the roster contains student names and PRNs).
2. In the project root terminal:
   ```bash
   git init
   git add .
   git commit -m "Initial SafeCommute BVP project"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```
3. Never make the repository public while it contains real student PRNs/names. Review the files staged for commit before pushing.

## Free deployment outline
### API on Render
- Create a new Web Service from the GitHub repository.
- Root directory: project root.
- Build command: `npm install`
- Start command: `npm run start`
- Health check path: `/api/health`
- Set `JWT_SECRET` to a long random secret and `CLIENT_ORIGIN` to the exact deployed frontend origin.
- Render provides an API URL such as `https://your-api.onrender.com`.

### Frontend on Vercel
- Import the same GitHub repository into Vercel.
- Set Root Directory to `client`.
- Framework preset: Vite.
- Build command: `npm run build`; output directory: `dist`.
- Add environment variable `VITE_API_URL=https://your-api.onrender.com` and redeploy.
- After the Vercel site is deployed, update the Render API's `CLIENT_ORIGIN` to the Vercel site's origin (for example `https://your-app.vercel.app`), then redeploy/restart the API.

### Important persistence limitation
This development build currently uses `server/data/db.json`, not MongoDB. Free cloud containers may use ephemeral storage, so user changes can be lost on redeploy/restart. Treat the free deployment as a demo until the storage layer is migrated to a persistent database such as MongoDB Atlas and the roster/import process is reviewed. Do not upload real student data to a public repository or use the default demo accounts in a public deployment.
