import { usePrivy } from "@privy-io/react-auth";

interface WatermarkOverlayProps {
  isEnabled: boolean;
}

const WatermarkOverlay = ({ isEnabled }: WatermarkOverlayProps) => {
  const { user } = usePrivy();

  if (!isEnabled || !user) {
    return null;
  }

  const userName = user.google?.name || user.wallet?.address?.slice(0, 10) + "..." || "User";
  const userEmail = user.google?.email || user.wallet?.address || "";

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {/* Single center watermark (subtle, non-intrusive) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center opacity-10 select-none">
          <div
            className="font-normal text-gray-500"
            style={{ fontSize: '3rem' }}
          >
            {userName}
          </div>
          <div
            className="font-light text-gray-400 mt-1"
            style={{ fontSize: '1.5rem' }}
          >
            {userEmail}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatermarkOverlay;
