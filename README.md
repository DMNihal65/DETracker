# DE Mastery Tracker & Schedule V2

This repository contains the DE Mastery Tracker & Schedule V2 application.

## Gemini API Key Configuration

To protect your Gemini API key, it has been removed from the source code and is injected during deployment using environment variables.

### Local Setup
When running locally:
1. Open the tracker.
2. Go to settings (via the UI).
3. Paste your Gemini API key there. It will be securely stored in your browser's local storage and used for subsequent requests.

### Netlify Deployment
1. Go to your **Site Settings** on Netlify.
2. Navigate to **Site configuration** > **Environment variables**.
3. Add a new variable:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `[Your Gemini API Key]`
4. Trigger a deploy. Netlify will automatically run `node inject-env.js` as the build command to inject the key into `index.html` during the build process.

### GitHub Pages / GitHub Actions Deployment
If you deploy using GitHub Actions, you can configure your workflow file (e.g. `.github/workflows/deploy.yml`) to inject the key:

1. Add your Gemini API key as a GitHub Repository Secret:
   - Go to **Settings** > **Secrets and variables** > **Actions**.
   - Create a repository secret named `GEMINI_API_KEY`.
2. Update/add a step in your deployment workflow to run `node inject-env.js` before deploying the static files, ensuring the secret is passed in:
   ```yaml
   - name: Inject API Key
     run: node inject-env.js
     env:
       GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
   ```
