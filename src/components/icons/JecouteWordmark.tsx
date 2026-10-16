import React from "react";

// Wordmark « J’écoute » en Chakra Petch Bold, converti en tracés (net à toutes
// les tailles, aucune dépendance au chargement de la police). Le texte suit la
// couleur courante ; l'accent de « é » porte le rouge des voyants.
const BODY =
  "M20 -121V-251H152.0V-167L203 -116H336.0L384 -163V-700H520.0V-117L403 0H140.0Z M824 -102V-394L927 -498H1208.0L1312 -394V-205H956.0V-141L988 -108H1151.0L1181 -139V-165H1311.0V-100L1212 0H925.0ZM1180 -297V-355L1146 -390H990.0L956 -355V-297Z M1407 -102V-396L1508 -498H1782.0L1885 -394V-302H1753.0V-351L1718 -386H1574.0L1539 -351V-147L1574 -112H1718.0L1753 -147V-196H1885.0V-104L1782 0H1508.0Z M1965 -104V-394L2068 -498H2354.0L2457 -394V-104L2354 0H2068.0ZM2290 -110 2325 -145V-353L2290 -388H2132.0L2097 -353V-145L2132 -110Z M2562 -105V-498H2694.0V-146L2728 -112H2808.0L2906 -210V-498H3038.0V0H2916.0V-85L2830 0H2667.0Z M3203 -102V-387H3113.0V-498H3205.0V-660H3335.0V-498H3487.0V-386H3335.0V-145L3369 -112H3487.0V0H3306.0Z M3547 -102V-394L3650 -498H3931.0L4035 -394V-205H3679.0V-141L3711 -108H3874.0L3904 -139V-165H4034.0V-100L3935 0H3648.0ZM3903 -297V-355L3869 -390H3713.0L3679 -355V-297Z M683 -550H661.0L618 -593V-657L661 -700H736.0L778 -656V-550L721 -416H643.0Z";
const ACCENT = "M1085 -713H1224.0L1125 -544H1009.0Z";

const VIEWBOX_WIDTH = 4015;
const VIEWBOX_HEIGHT = 713;

interface JecouteWordmarkProps {
  width?: number;
  height?: number;
  className?: string;
}

const JecouteWordmark: React.FC<JecouteWordmarkProps> = ({
  width,
  height,
  className = "",
}) => {
  // Une seule dimension suffit : l'autre suit les proportions du tracé.
  const w = width ?? (height ? (height * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT : 120);
  const h = height ?? (w * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH;
  return (
    <svg
      width={w}
      height={h}
      viewBox="20 -713 4015 713"
      role="img"
      aria-label="J’écoute"
      className={`shrink-0 text-text ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={BODY} fill="currentColor" />
      <path d={ACCENT} className="fill-accent" />
    </svg>
  );
};

export default JecouteWordmark;
