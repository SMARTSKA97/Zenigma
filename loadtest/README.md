# Load test

`k6.js` plays the part of many people opening the app. Install k6 once (`winget install k6` on Windows), then from the repo root:

```powershell
k6 run loadtest/k6.js                                                         # 5 players for ~2 minutes, public pages only
k6 run -e PROFILE=heavy loadtest/k6.js                                        # ramps to 50 players
k6 run -e EMAIL=test@example.com -e PASSWORD='...' loadtest/k6.js             # also tests the signed-in screens
```

Use a throwaway account. Run off-peak: it wakes the free server and uses its instance hours. The test passes when the summary shows all thresholds green (under 2% failed requests, API 95th percentile under 800 ms).

Read the result like this:
- **`http_req_duration{kind:api}` p(95)**: how slow the slowest 5% of API calls were. Under 800 ms is healthy on the free tier.
- **`http_req_failed`**: anything above 2% means the server, database or a rate limit is struggling. The built-in limits (auth 5/min and similar) can produce 429s if you test sign-in in a loop; the script signs in only once.
- **`board 304`** checks that the ETag saves the body on repeat requests.

Also watch the Render **Metrics** tab (CPU, memory) and the Neon **Monitoring** page (connections, CPU) while it runs.
