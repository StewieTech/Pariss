Lola Expo Demo

Run the Expo app (Fast Refresh enabled by default):

```powershell
cd expo-app
npm install
npm run dev
```

Notes:
- `dev` uses `expo start --dev-client` to enable development client workflows.
- If testing on a physical device, replace the API host in `App.tsx` with your machine IP, e.g. `http://192.168.1.5:4000`.
