/**
 * SVG filters the brand relies on, defined once in the root layout.
 *
 * stamp-ink: roughens the edge of a rubber stamp and leaves patches where the
 * pad was dry, so no two stamps look identical.
 *
 * duo-blue-pink and duo-blue-yellow: map a photograph's luminance onto two
 * riso inks (shadows in Federal Blue, highlights in pink or yellow), the way a
 * two-color print does. Midtones land on the overprint of the two inks.
 */
export function InkFilters() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute" focusable="false">
      <defs>
        <filter id="stamp-ink" x="-6%" y="-10%" width="112%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="7" result="edge" />
          <feDisplacementMap in="SourceGraphic" in2="edge" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.07 0.09" numOctaves="3" seed="11" result="pad" />
          <feColorMatrix in="pad" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.55" result="padAlpha" />
          <feComposite in="rough" in2="padAlpha" operator="in" />
        </filter>
        <filter id="duo-blue-pink" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.239 1" />
            <feFuncG type="table" tableValues="0.333 0.282" />
            <feFuncB type="table" tableValues="0.533 0.69" />
          </feComponentTransfer>
        </filter>
        <filter id="duo-blue-yellow" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.239 1" />
            <feFuncG type="table" tableValues="0.333 0.91" />
            <feFuncB type="table" tableValues="0.533 0" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
