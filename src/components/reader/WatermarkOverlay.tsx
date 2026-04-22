import { usePrivy } from "@privy-io/react-auth";

interface WatermarkOverlayProps {
  isEnabled: boolean;
}

const WatermarkOverlay = ({ isEnabled }: WatermarkOverlayProps) => {
  const { user } = usePrivy();

  if (!isEnabled || !user) return null;

  const label =
    user.google?.email ||
    user.email?.address ||
    (user.wallet?.address
      ? user.wallet.address.slice(0, 8) + "…" + user.wallet.address.slice(-6)
      : "");

  if (!label) return null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-10 flex items-center justify-center">
      <p
        className="text-zinc-500 font-light"
        style={{ opacity: 0.12, transform: "rotate(-20deg)", fontSize: "28px" }}
      >
        {label}
      </p>
    </div>
  );
};

export default WatermarkOverlay;
