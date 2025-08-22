# Setup Guide

This guide will help you set up SharedListsApp for local development and production deployment.

## Prerequisites

- Node.js 22+ 
- npm
- Docker Desktop (or compatible container runtime like Rancher Desktop, Podman, or OrbStack)
- A Supabase account (for production deployment)
- Git

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/sandymcfadden/SharedListsApp.git
cd SharedListsApp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set up Supabase

You have two options for development: **Local Supabase** (recommended) or **Remote Supabase**.

#### Option A: Local Supabase Development (Recommended)

Local development with Supabase provides several advantages:
- **Faster development**: Instant changes without remote deployments
- **Offline work**: Continue development without internet connection
- **Cost-effective**: Free and doesn't consume project quota
- **Enhanced privacy**: Sensitive data stays on your local machine
- **Easy testing**: Experiment without affecting production

1. **Start local Supabase stack**:
   ```bash
   npm run supabase:start
   ```

2. **View your local Supabase instance**:
   - Open [http://localhost:54323](http://localhost:54323) in your browser
   - This gives you access to the local Supabase dashboard

3. **Get local credentials** (automatically configured):
   - **Project URL**: `http://localhost:54321`
   - **anon key**: Will be displayed in the terminal output

#### Option B: Remote Supabase Project

If you prefer to use a remote Supabase project:

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `sharedlistsapp` (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Choose the closest region to your users
5. Click "Create new project"
6. Wait for the project to be created (this may take a few minutes)

7. **Get your project credentials**:
   - In your Supabase dashboard, go to **Settings** → **API**
   - Copy the following values:
     - **Project URL**: `https://your-project-id.supabase.co`
     - **anon public** key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
touch .env
```

#### For Local Development (Option A)

Add your local Supabase credentials to the `.env` file:

```env
# Local Supabase (default for development)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key-from-terminal-output
```

The anon key will be displayed in the terminal when you run `npm run supabase:start`.

#### For Remote Development (Option B)

Add your remote Supabase credentials to the `.env` file:

```env
# Remote Supabase
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the placeholder values with your actual Supabase project URL and anon key.

### 5. Set up the Database

#### For Local Development (Option A)

The database migrations are automatically applied when you start the local Supabase stack:

1. **Start local Supabase** (if not already running):
   ```bash
   npm run supabase:start
   ```

2. **Apply migrations**:
   ```bash
   npm run supabase:reset
   ```
   This will reset the local database and apply all migrations from `supabase/migrations/`.

3. **Verify setup**:
   - Open [http://localhost:54323](http://localhost:54323)
   - Go to **Table Editor** to see your tables
   - Check **SQL Editor** to run queries

#### For Remote Development (Option B)

1. **Apply migrations to remote project**:
   ```bash
   npm run supabase:push
   ```

2. **Or manually set up the database**:
   - Go to your Supabase dashboard
   - Navigate to **SQL Editor**
   - Copy the contents of `supabase/migrations/20240101000000_initial_schema.sql`
   - Paste and run the SQL in the editor

### 6. Configure Authentication

#### For Local Development (Option A)

Local Supabase automatically configures authentication for development:

1. **Access local Supabase dashboard**: [http://localhost:54323](http://localhost:54323)
2. **Go to Authentication** → **Settings**
3. **Site URL**: Already set to `http://localhost:3000`
4. **Redirect URLs**: Already configured for local development

#### For Remote Development (Option B)

1. In your Supabase dashboard, go to **Authentication** → **Settings**
2. Configure the following settings:

**Site URL**
- Set to `http://localhost:3000` for development
- Set to your production URL for deployment

**Redirect URLs**
Add these redirect URLs:
- `http://localhost:3000/manage/#/lists` (for development)
- `https://yourdomain.com/manage/#/lists` (for production)

### 7. Start Development Server

```bash
npm run dev
```

Open your browser to `http://localhost:3000` and you should see the landing page. Click "Start Using Shared Lists" to access the app.

### 8. Useful Local Development Commands

The project includes several npm scripts for managing your local Supabase instance:

```bash
# Start local Supabase stack
npm run supabase:start

# Stop local Supabase stack
npm run supabase:stop

# Check Supabase status
npm run supabase:status

# Reset local database and apply migrations
npm run supabase:reset

# Push migrations to remote (if using remote Supabase)
npm run supabase:push

# Generate database diff
npm run supabase:diff
```

### 9. Test Authentication

1. **For Local Development**: 
   - Open [http://localhost:54323](http://localhost:54323) to access the local Supabase dashboard
   - Go to **Authentication** → **Users** to see registered users
   - Test sign up/sign in functionality in your app

2. **For Remote Development**:
   - Go to your Supabase dashboard
   - Navigate to **Authentication** → **Users**
   - Test the authentication flow in your app

## Production Deployment

### 1. Build the Application

```bash
npm run build
```

This creates a `dist/` folder with all the production files.

### 2. Deploy to Static Hosting

The app can be deployed to any static hosting service:

#### Vercel
```bash
npm install -g vercel
vercel --prod
```

#### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

#### GitHub Pages
```bash
npm install -g gh-pages
gh-pages -d dist
```

### 3. Update Supabase Settings

After deployment, update your Supabase authentication settings:

1. Go to **Authentication** → **Settings**
2. Update **Site URL** to your production domain
3. Add your production redirect URL to the **Redirect URLs** list

### 4. Environment Variables

Make sure your production environment has the correct environment variables:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Troubleshooting

### Common Issues

#### "Supabase URL and API key are required" error
- Make sure your `.env` file exists and has the correct values
- Restart your development server after creating the `.env` file
- For local development, ensure `npm run supabase:start` is running

#### Local Supabase not starting
- Make sure Docker is running on your machine
- Check if ports 54321, 54322, and 54323 are available
- Try `npm run supabase:stop` then `npm run supabase:start`

#### Authentication redirect issues
- **Local**: Check that your local Supabase is running at [http://localhost:54323](http://localhost:54323)
- **Remote**: Check that your Site URL and Redirect URLs are configured correctly
- Make sure you're using the correct URL format (with `#/manage` for hash routing)

#### CORS errors
- **Local**: Ensure your local Supabase is running and accessible
- **Remote**: Ensure your Site URL in Supabase settings matches your development URL
- Check that you're using the correct anon key

#### Database connection issues
- **Local**: Run `npm run supabase:status` to check if all services are running
- **Remote**: Verify your Supabase project is active
- Check that the database migrations have been applied
- Ensure your API key has the correct permissions

### Development vs Production URLs

**Local Development:**
- Supabase URL: `http://localhost:54321`
- Supabase Dashboard: `http://localhost:54323`
- App URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/manage/#/lists`

**Remote Development:**
- Supabase URL: `https://your-project-id.supabase.co`
- App URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/manage/#/lists`

**Production:**
- Supabase URL: `https://your-project-id.supabase.co`
- App URL: `https://yourdomain.com`
- Redirect URL: `https://yourdomain.com/manage/#/lists`

## Security Notes

1. **Never commit your `.env` file** - it's already in `.gitignore`
2. **Use environment variables** for all sensitive configuration
3. **The anon key is safe to use in the browser** - it has limited permissions
4. **Row Level Security (RLS)** is enabled on all database tables

## Next Steps

Once you have the basic setup working:

1. **[Read the Architecture Guide](architecture.md)** to understand how the system works
2. **[Check the Development Guide](development.md)** for contributing guidelines
3. **[Review the API Reference](api.md)** for service interfaces
4. **[See the Deployment Guide](deployment.md)** for production deployment details

## Getting Help

If you run into issues:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review the [GitHub issues](https://github.com/sandymcfadden/SharedListsApp/issues)
3. Open a new issue with details about your problem
4. Join our community discussions
