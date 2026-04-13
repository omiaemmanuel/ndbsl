/**
 * NBSL logo — isometric hexagonal cube, reproduced as pure SVG.
 * Uses `currentColor` so it inherits the text color of its parent.
 * Pass a `color` prop to override (e.g. color="white" on dark backgrounds).
 */
export function NbslLogo({
  size = 32,
  color,
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  // Pointy-top regular hexagon, center (50, 53), circumradius 46
  // Six vertices at angles 90°, 30°, -30°, -90°, -150°, 150°
  const cx = 50, cy = 53, r = 46;
  const angles = [90, 30, -30, -90, -150, 150];
  const pts = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return [+(cx + r * Math.cos(rad)).toFixed(2), +(cy - r * Math.sin(rad)).toFixed(2)];
  });

  // Outer hexagon path
  const hexPath =
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';

  // Six spokes from center to each vertex
  const spokes = pts.map(([x, y], i) => (
    <line key={i} x1={cx} y1={cy} x2={x} y2={y} />
  ));

  const stroke = color ?? 'currentColor';

  return (
    <svg
      width={size}
      height={Math.round(size * 1.06)}
      viewBox="0 0 100 106"
      fill="none"
      stroke={stroke}
      strokeWidth="8.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="NBSL logo"
    >
      <path d={hexPath} />
      {spokes}
    </svg>
  );
}
