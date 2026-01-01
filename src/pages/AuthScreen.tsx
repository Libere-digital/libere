import AuthLayout from "../components/layouts/AuthLayout";
import GoogleAuthButton from "../components/buttons/GoogleAuthButton";
import { useLoginWithOAuth } from "@privy-io/react-auth";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useCreateWallet } from "@privy-io/react-auth";

const AuthScreen = () => {
  const navigate = useNavigate();
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  const { createWallet } = useCreateWallet({
    onSuccess: () => {
      console.log("Smart wallet created successfully");
      setIsCreatingWallet(false);
      // Navigate to books after wallet is ready
      navigate("/books");
    },
    onError: (error) => {
      console.error("Failed to create smart wallet:", error);
      setIsCreatingWallet(false);
      // Still navigate even if wallet creation fails
      // User can try again from navbar
      navigate("/books");
    },
  });

  const { initOAuth } = useLoginWithOAuth({
    onComplete: () => {
      // After login, automatically create smart wallet
      console.log("Login completed, creating smart wallet...");
      setIsCreatingWallet(true);
      createWallet();
    },
    onError: (error) => {
      console.error("Login failed", error);
      setIsCreatingWallet(false);
    },
  });

  const handleGoogleSignIn = async () => {
    try {
      await initOAuth({ provider: "google" });
    } catch (err) {
      console.error(err);
      setIsCreatingWallet(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col justify-center items-center">
        <img
          src="/images/Logotype and Mark Green Platform (2).png"
          alt="Libere Logo"
          className="h-16 xl:h-20 w-auto"
        />
        <p className="text-sm mt-4 text-dark-600">
          Publish, Buy, Donate Digital Book On Chain
        </p>
      </div>

      <div className="w-full mt-4 flex-col items-start">
        <div className="flex flex-col items-center">
          {!isCreatingWallet ? (
            <GoogleAuthButton onClick={handleGoogleSignIn} />
          ) : (
            <div className="w-full max-w-xs">
              <button
                disabled
                className="cursor-not-allowed w-full font-bold border border-zinc-200 rounded-lg py-3 bg-zinc-100 text-zinc-400 flex items-center justify-center opacity-50"
              >
                <span>Signing in...</span>
              </button>
            </div>
          )}

          {isCreatingWallet && (
            <div className="mt-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 mx-auto mb-2"></div>
              <p className="text-sm text-zinc-600">Setting up your wallet...</p>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
};

export default AuthScreen;
