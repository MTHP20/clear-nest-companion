Welcome to ClearNest
Project Overview

ClearNest is an early-stage MVP focused on helping users manage and understand financial and care-related information through a conversational AI assistant (“Clara”) and a supporting dashboard.

Current State of the Project
What Exists
Landing page with early access signup (emails stored in Supabase)
Clara voice agent (basic conversational functionality)
Dashboard UI (partially functional)
Backend integration with Supabase for storing conversation history
What Users Can Do
Production:
View landing page
Sign up for early access
Development (localhost):
Complete onboarding flow
Interact with Clara (voice agent)
Store conversation history and extracted structured data
Tech Stack
Vite
TypeScript
React
Tailwind CSS
shadcn-ui
Supabase
Running the Project Locally
Prerequisites
Node.js (recommended via nvm)
npm
Setup Instructions
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate into the project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev

The app will run locally with hot reloading enabled.

Project Structure (High-Level)
Landing Page – Marketing + signup capture
Voice Agent (Clara) – Handles conversations and extracts structured data
Dashboard – Displays stored conversations and user-related insights
Backend (Supabase) – Stores:
User data
Conversation history
Extracted structured information
Deployment

To deploy ClearNest:

Build the project using your preferred hosting platform (e.g., Vercel, Netlify)
Ensure environment variables (Supabase, APIs, etc.) are configured

Run:
npm run build