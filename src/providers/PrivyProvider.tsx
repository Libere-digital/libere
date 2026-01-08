import { PrivyProvider } from "@privy-io/react-auth";
import config from "../libs/config";
import { baseSepolia } from "viem/chains";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }): ReactNode {
  // Type assertion to handle Privy v2 (React 18) compatibility with React 19
  const PrivyProviderCompat = PrivyProvider as any;

  return (
    <PrivyProviderCompat
      appId={config.env.privy.appId}
      clientId={config.env.privy.clientId}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
      }}
    >
      <SmartWalletsProvider>{children}</SmartWalletsProvider>
    </PrivyProviderCompat>
  );
}
