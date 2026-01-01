import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Providers from "./providers/PrivyProvider.tsx";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthScreen from "./pages/AuthScreen.tsx";
import HomeScreen from "./pages/HomeScreen.tsx";
import BookDetailScreen from "./pages/BookDetailScreen.tsx";

import { Buffer } from 'buffer';
import LibraryListScreen from "./pages/LibraryListScreen.tsx";
import LibraryDetailScreen from "./pages/LibraryDetailScreen.tsx";
import BookselfScreen from "./pages/BookselfScreen.tsx";
import DocumentReaderScreen from "./pages/DocumentReaderScreen.tsx";
import AudiobookPlayerScreen from "./pages/AudiobookPlayerScreen.tsx";
import { CurrencyProvider } from "./contexts/CurrencyContext.tsx";
import ProtectedRoute from "./routes/ProtectedRoute.tsx";
import { registerSW } from "virtual:pwa-register";

window.Buffer = Buffer;

// Suppress iframe extension errors (from browser extensions/Privy trying to access ReactReader iframe)
window.addEventListener('error', (event) => {
  if (event.message?.includes('request from iframe is not supported')) {
    console.log('🔇 [Suppressed] Browser extension iframe error (safe to ignore)');
    event.preventDefault();
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('request from iframe is not supported')) {
    console.log('🔇 [Suppressed] Browser extension iframe promise rejection (safe to ignore)');
    event.preventDefault();
  }
});

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("New content available. Reload to update?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <CurrencyProvider>
        <BrowserRouter>
        <Routes>
          {/* Public routes - accessible without login */}
          <Route path="/" element={<Navigate to="/books" replace />} />
          <Route path="/auth" element={<AuthScreen />} />
          <Route path="/books" element={<HomeScreen />} />
          <Route path="/books/:id" element={<BookDetailScreen />} />
          <Route path="/libraries/:id" element={<LibraryDetailScreen />} />

          {/* Protected routes - require authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/libraries" element={<LibraryListScreen />} />
            <Route path="/bookselfs" element={<BookselfScreen />} />
            {/* Temporarily hidden - Publish Book route */}
            {/* <Route path="/publish" element={<CreateBookV2Screen />} /> */}
            {/* Unified reader for both EPUB and PDF - auto-detects type */}
            <Route path="/read-book/:id" element={<DocumentReaderScreen />} />
            {/* Old PDF route redirects to unified reader for backward compatibility */}
            <Route path="/read-pdf/:id" element={<Navigate to="/read-book/:id" replace />} />
            {/* Audiobook player - protected route */}
            <Route path="/listen-audiobook/:id" element={<AudiobookPlayerScreen />} />
          </Route>

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/books" replace />} />
        </Routes>
        </BrowserRouter>
      </CurrencyProvider>
    </Providers>
  </StrictMode>
);
