# CVScan AI — ATS Analyzer Dashboard

CVScan AI is an intelligent Applicant Tracking System (ATS) resume analyzer designed to help job seekers optimize their resumes. By uploading a CV and pasting a target Job Description, users receive an instant ATS match score and a detailed keyword gap analysis.

## Features

- **Modern SaaS Interface:** A clean, professional, light-themed dashboard.
- **Smart Parsing:** Supports extracting text directly from PDF, DOCX, and TXT files directly in the browser.
- **AI-Powered Analysis:** Uses a triple-fallback AI strategy (Gemini -> Together AI -> Fireworks AI) to score the resume and identify both matched and missing keywords.
- **Keyword Gap Analysis:** Actionable insights outlining exactly which keywords you need to add to bypass ATS filters.

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory and add your API keys:
   ```env
   GEMINI_API_KEY=your_key_here
   TOGETHER_API_KEY=your_key_here
   FIREWORKS_API_KEY=your_key_here
   PORT=3000
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   The application will be available at `http://localhost:3000`.

## Deployment

This project is configured to be deployed on Vercel (using the included `vercel.json`).

trigger redeploy
