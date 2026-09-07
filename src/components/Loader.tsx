import { Trefoil } from "ldrs/react";
import "ldrs/react/Trefoil.css";

// Single import point for the app's loader so the color/defaults stay
// consistent -- the ldrs default color="black" is invisible on this dark
// theme, so it's pinned to --primary here instead.
export function Loader({ size = "40" }: { size?: string }) {
  return <Trefoil size={size} stroke="4" strokeLength="0.15" bgOpacity="0.1" speed="1.4" color="var(--primary)" />;
}
