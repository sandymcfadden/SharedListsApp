# Deployment Guide

This guide covers how to deploy SharedListsApp to production, including environment setup, build configuration, and hosting options.

## 🚀 Production Build

### Build Process

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set environment variables**
   ```bash
   # Create production .env file
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Build for production**
   ```bash
   npm run build
   ```

4. **Preview production build**
   ```bash
   npm run preview
   ```

### Build Output

The build process creates a `dist/` folder with:
- `index.html` - Landing page
- `manage/index.html` - React application
- `assets/` - JavaScript and CSS bundles
- `manifest.json` - PWA manifest
- `sw.js` - Service worker

## 🌐 Hosting Options

### Static Hosting (Recommended)

SharedListsApp is designed as a static web application and can be deployed to any static hosting service.

#### Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Configure environment variables**
   - Go to Vercel dashboard
   - Navigate to project settings
   - Add environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

#### Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**
   ```bash
   netlify deploy --prod --dir=dist
   ```

3. **Configure environment variables**
   - Go to Netlify dashboard
   - Navigate to site settings
   - Add environment variables in "Environment variables" section

#### GitHub Pages

1. **Install gh-pages**
   ```bash
   npm install -g gh-pages
   ```

2. **Deploy**
   ```bash
   gh-pages -d dist
   ```

3. **Configure environment variables**
   - Use GitHub Secrets for sensitive data
   - Update build process to use secrets

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Service Role Key (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Environment
NODE_ENV=production
```

### Environment-Specific Configuration

#### Development
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
NODE_ENV=development
```

#### Production
```bash
VITE_SUPABASE_URL=https://production-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
NODE_ENV=production
```

## 🗄️ Database Setup

### Supabase Configuration

1. **Create production project**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Create new project
   - Choose production region

2. **Apply migrations**
   ```bash
   # Using Supabase CLI
   supabase db push --project-ref your-project-id
   
   # Or manually in SQL Editor
   # Copy and run contents of supabase/migrations/20240101000000_initial_schema.sql
   ```

3. **Configure authentication**
   - Go to Authentication → Settings
   - Set Site URL to your production domain
   - Add redirect URLs:
     - `https://yourdomain.com/manage/#/lists`
     - `https://yourdomain.com/manage/#/auth`

4. **Set up Row Level Security**
   - Verify RLS policies are enabled
   - Test with production data

This deployment guide should help you successfully deploy SharedListsApp to production. For specific hosting provider instructions, refer to their documentation.
