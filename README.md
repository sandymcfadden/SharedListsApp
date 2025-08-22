# SharedListsApp

A collaborative, offline-first list management system built with React, TypeScript, Y.js, and Supabase. Perfect for family grocery lists, shared task lists, and any scenario where multiple people need to collaborate on lists in real-time.

## ✨ Features

- **🔄 Real-time Collaboration**: Multiple users can edit the same list simultaneously without conflicts
- **📱 Offline-First**: Works completely offline with automatic sync when connection is restored
- **🔐 Secure Sharing**: Share individual lists with specific people via invitation links
- **⚡ Instant Updates**: Optimistic UI updates for immediate feedback
- **🌐 Cross-Platform**: Web app with PWA support, mobile-ready architecture
- **🎨 Modern UI**: Clean, responsive interface built with Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Node.js 22+ 
- npm
- Docker Desktop (for local Supabase development)
- Supabase account (for production deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sandymcfadden/SharedListsApp.git
   cd SharedListsApp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase (Local Development - Recommended)**
   
   Start local Supabase stack:
   ```bash
   npm run supabase:start
   ```
   
   Create a `.env` file with local credentials:
   ```bash
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_ANON_KEY=your-local-anon-key-from-terminal
   ```
   
   **Alternative**: Use remote Supabase project (see [Setup Guide](docs/setup.md) for details)

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:3000` to see the landing page, then click "Start Using Shared Lists" to access the app.

## 🏗️ Project Structure

```
SharedListsApp/
├── public/                 # Static assets and landing page
├── src/
│   ├── components/         # React components
│   │   ├── auth/          # Authentication components
│   │   └── ui/            # UI components
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page components
│   ├── services/          # Service layer with interfaces
│   │   ├── interfaces/    # Service contracts
│   │   ├── implementations/ # Service implementations
│   │   └── controllers/   # Business logic controllers
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── supabase/              # Database migrations and setup
├── docs/                  # Documentation
└── dist/                  # Production build output
```

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **CRDT**: Y.js with custom IndexedDB storage
- **Backend**: Supabase (Auth, Database, Real-time)
- **Routing**: React Router (HashRouter)
- **Architecture**: Service container with interface-driven design

## 📚 Documentation

- **[Architecture Overview](docs/architecture.md)** - System design and key components
- **[Setup Guide](docs/setup.md)** - Detailed setup instructions
- **[Development Guide](docs/development.md)** - How to contribute and extend the app
- **[API Reference](docs/api.md)** - Service interfaces and implementations
- **[Deployment Guide](docs/deployment.md)** - Production deployment instructions

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🌟 Key Features Explained

### Offline-First Architecture
The app works completely offline using IndexedDB for local storage. When you're online, changes automatically sync with the server and other users.

### Real-time Collaboration
Built on Y.js CRDT (Conflict-free Replicated Data Type) technology, allowing multiple users to edit the same list simultaneously without data loss.

### Optimistic Updates
UI updates happen immediately for instant feedback, with automatic rollback if operations fail.

### Secure Sharing
Share lists with specific people via invitation links. Each list has its own permissions and access control.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Y.js](https://github.com/yjs/yjs) for CRDT implementation
- [Supabase](https://supabase.com) for backend services
- [Tailwind CSS](https://tailwindcss.com) for styling
- [React](https://reactjs.org) for the UI framework

---

**Need help?** Check out our [documentation](docs/) or open an issue on GitHub.