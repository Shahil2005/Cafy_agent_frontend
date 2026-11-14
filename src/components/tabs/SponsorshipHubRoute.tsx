import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getDefaultSponsorshipPath } from "../../utils/sponsorshipHubRouting";
import SponsorshipHubV2 from "./SponsorshipHubV2";
import SponsorshipHubIreland from "./SponsorshipHubIreland";

type SponsorshipHubVariant = "uk" | "ireland";

interface SponsorshipHubRouteProps {
  variant: SponsorshipHubVariant;
}

const SponsorshipHubRoute: React.FC<SponsorshipHubRouteProps> = ({ variant }) => {
  const { user, profileLoaded } = useAuth();

  if (!profileLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Loading sponsorship hub…</p>
      </div>
    );
  }

  const targetPath = getDefaultSponsorshipPath(user?.preferences);

  if (variant === "uk" && targetPath === "/sponsorship/ireland") {
    return <Navigate to="/sponsorship/ireland" replace />;
  }

  if (variant === "ireland" && targetPath === "/sponsorship") {
    return <Navigate to="/sponsorship" replace />;
  }

  return variant === "ireland" ? <SponsorshipHubIreland /> : <SponsorshipHubV2 />;
};

export default SponsorshipHubRoute;
