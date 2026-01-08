import React, { useState, useRef, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { FaUserCircle, FaCopy, FaSignOutAlt } from "react-icons/fa";

interface StandaloneLayoutProps {
  children: React.ReactNode;
  librarySlug?: string;        // e.g., 'theroom19'
  libraryLogo?: string;         // e.g., '/library-logos/room19.png'
  libraryName?: string;         // e.g., 'Bandung City Digital Library'
  libraryTagline?: string;      // e.g., 'Dinas Arsip dan Perpustakaan Kota Bandung'
  showScrollNav?: boolean;      // Enable scroll navigation menu
}

const StandaloneLayout: React.FC<StandaloneLayoutProps> = ({
  children,
  libraryLogo,
  libraryName,
  libraryTagline,
  showScrollNav = false
}) => {
  const { authenticated, login, logout, user } = usePrivy();
  const { client } = useSmartWallets();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const username = user?.google?.name || user?.google?.email || "User";
  const email = user?.google?.email || "";

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 64; // Navbar height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const copyAddress = () => {
    if (client?.account?.address) {
      navigator.clipboard.writeText(client.account.address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Minimal header with library logo and navigation (The Room 19) or wallet only (others) */}
      <header className="sticky top-0 bg-white z-50 py-3 border-b border-zinc-200 shadow-sm">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto px-4 sm:px-6">
          {/* Left section: Logo + Library Info + Navigation (conditional) */}
          <div className="flex items-center gap-3 sm:gap-6">
            {libraryLogo && (
              <img
                src={libraryLogo}
                alt="Library Logo"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-zinc-300"
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
            )}

            {/* Library Name & Tagline */}
            {libraryName && (
              <div className="flex flex-col">
                <h1 className="text-sm sm:text-base font-bold text-zinc-900 leading-tight">
                  {libraryName}
                </h1>
                {libraryTagline && (
                  <p className="text-xs text-zinc-600 hidden sm:block">
                    {libraryTagline}
                  </p>
                )}
              </div>
            )}

            {showScrollNav && (
              <nav className="hidden md:flex items-center gap-4 text-sm">
                <button
                  onClick={() => scrollToSection('books')}
                  className="text-zinc-700 hover:text-black font-medium transition-colors"
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection('reservation')}
                  className="text-zinc-700 hover:text-black font-medium transition-colors"
                >
                  Reservation
                </button>
                <button
                  onClick={() => scrollToSection('address')}
                  className="text-zinc-700 hover:text-black font-medium transition-colors"
                >
                  Maps
                </button>
              </nav>
            )}
          </div>

          {/* Right section: Wallet connection */}
          <div className="flex items-center">
          {authenticated ? (
            client ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 transition-colors"
                >
                  <FaUserCircle className="text-zinc-600 text-xl" />
                  <span className="text-sm font-medium text-zinc-900 hidden sm:inline">{username}</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-zinc-200 py-2 z-50">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-zinc-100">
                      <p className="text-sm font-semibold text-zinc-900">{username}</p>
                      {email && <p className="text-xs text-zinc-500 mt-0.5">{email}</p>}
                    </div>

                    {/* Wallet Address */}
                    <div className="px-4 py-3 border-b border-zinc-100">
                      <p className="text-[11px] text-zinc-500 font-medium mb-1">Wallet Address</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-mono text-zinc-900">
                          {client.account.address.slice(0, 8)}...{client.account.address.slice(-6)}
                        </p>
                        <button
                          onClick={copyAddress}
                          className="p-1.5 hover:bg-zinc-100 rounded transition-colors"
                          title="Copy address"
                        >
                          <FaCopy className={`text-xs ${copySuccess ? "text-green-600" : "text-zinc-500"}`} />
                        </button>
                      </div>
                      {copySuccess && <p className="text-[10px] text-green-600 mt-1">Copied!</p>}
                    </div>

                    {/* Logout Button */}
                    <div className="px-4 py-2">
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
                      >
                        <FaSignOutAlt className="text-xs" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Loading wallet
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-900"></div>
                <span className="hidden sm:inline">Setting up wallet...</span>
              </div>
            )
          ) : (
            // Login button
            <button
              onClick={login}
              className="cursor-pointer text-white bg-zinc-900 hover:bg-zinc-800 font-bold rounded-lg text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5 transition-all shadow-md hover:shadow-lg"
            >
              Connect Wallet
            </button>
          )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
};

export default StandaloneLayout;
