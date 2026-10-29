# Deploying Good News Everywhere on Coolify

Hand the "Agent brief" below to a computer-control agent. Fill in the three values in the first block first.

## What you do first (needs you, not the agent)

1. Push this repo to a Git host Coolify can reach (GitHub, GitLab or your own Gitea). The branch is `master`.
2. Choose the public domain, for example `goodnews.example.com`, and point its DNS A record at your home or NAS public IP. Ports 80 and 443 must reach the NAS, because Coolify's proxy needs them to issue the HTTPS certificate.
3. Pick an admin token, any long random string. You will give it to the agent, or better, type it into Coolify yourself.

## Agent brief

```
GOAL
Deploy the web app in my Git repository to my Coolify instance, reachable over HTTPS at my domain, and prove it works.

VALUES (I will fill these in)
- Coolify URL: <COOLIFY_URL>
- Git repository URL: <GIT_REPO_URL>   branch: master
- Domain: <DOMAIN>
- Admin token: <ADMIN_TOKEN>   (a secret: enter it only into Coolify's environment variable field; never paste it anywhere else or into screenshots)

RULES
- Work only inside a new Coolify project named "Good News Everywhere". Do not open, edit, restart or delete any other project, server or resource.
- If a login, two-factor prompt or captcha appears, stop and ask me. Do not guess passwords.
- If anything differs from these steps (a missing option, an error), stop and tell me what you see before improvising. Do not change the repository or the Dockerfile.

STEPS
1. Open <COOLIFY_URL> and sign in (ask me if you are not already signed in).
2. Projects -> + Add -> name it "Good News Everywhere". Open the default environment.
3. + New Resource -> choose the Git source that matches my repo (Public Repository for a public repo; otherwise Private Repository with a deploy key or the GitHub App). Select the server that runs on my NAS.
4. Repository settings: paste <GIT_REPO_URL>, branch master, Build Pack "Dockerfile", base directory "/".
5. On the resource's Configuration page:
   a. General: set Domains to https://<DOMAIN>. Set Ports Exposes to 3000. Leave the Dockerfile location as /Dockerfile.
   b. Health check: enable it, path /healthz, port 3000.
   c. Environment Variables: add ADMIN_TOKEN with the admin token above. Mark it as a secret if the option exists. Do not add other variables; PORT, DATA_DIR and TRUST_PROXY are already set by the Dockerfile.
   d. Persistent Storage: add a Volume mount with destination path /storage (name it good-news-data). This keeps submitted stories and refreshed news across redeploys.
   e. Scheduled Tasks: add one task. Name: refresh-news. Command: node scripts/fetch-news.mjs. Frequency: 0 5 * * * (daily at 5am). Container: the app container.
6. Click Deploy. Watch the deployment log until it reports success. If the build fails, copy the last 30 log lines to me and stop.
7. Run the scheduled task once manually (Scheduled Tasks -> Execute Now) and confirm its log ends with "Wrote N stories".

VERIFY (do all of these and report the result of each)
- https://<DOMAIN>/ loads over HTTPS with a valid certificate and shows the headline "Somewhere right now, something is going well." and a world map with coloured pins.
- Clicking a pin or a story tile opens a story card.
- https://<DOMAIN>/digest.html loads.
- https://<DOMAIN>/healthz shows "ok".
- https://<DOMAIN>/server.mjs and https://<DOMAIN>/data/submissions.json both return "Not found" (404).
- Submit a test story through the form at the bottom of the home page (title "Test story please ignore", any details of 20+ characters). It should say "Thank you". If it shows an error instead, report the exact message.
- Open https://<DOMAIN>/admin.html, enter the admin token, and confirm the test story appears as pending. Choose Delete on it so it does not go public.
- Redeploy once from Coolify, then confirm the admin page still works (data survived).

REPORT BACK
A short list: each verify item as pass or fail, the final deployed URL, and anything unexpected. Do not include the admin token in the report.
```

## If something goes wrong

- **Certificate not issued:** DNS has not propagated or ports 80/443 do not reach the NAS.
- **Form says "That didn't send":** the /storage volume is not writable. Make sure it is a Coolify-managed volume (not a bind mount to a root-owned folder).
- **Everyone gets "Too many stories":** the proxy address is being used for rate limiting. Confirm `TRUST_PROXY=1` is set (the Dockerfile sets it).
- **News looks stale:** run the refresh-news scheduled task, or check its log for network errors.
