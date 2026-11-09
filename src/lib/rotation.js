// Otočenie obrazu na TV (napr. televízor zavesený na výšku). Hodnota je v stupňoch.
export const ROTATIONS = [
  { value: 0, label: 'Na šírku', hint: 'Bežný televízor' },
  { value: 90, label: 'Na výšku ↻', hint: 'Otočené doprava' },
  { value: 270, label: 'Na výšku ↺', hint: 'Otočené doľava' },
  { value: 180, label: 'Hore nohami', hint: 'Otočené o 180°' },
];

export function getRotation(settings) {
  const r = Number(settings?.rotation) || 0;
  return [0, 90, 180, 270].includes(r) ? r : 0;
}

export const isPortrait = (rotation) => rotation === 90 || rotation === 270;

// Štýl obalu, ktorý otočí celý obsah displeja. Pri 90°/270° má obal rozmery
// výška × šírka okna, takže text sa prispôsobí obrazovke na výšku.
export function rotationStyle(rotation) {
  if (!rotation) return { position: 'absolute', inset: 0 };
  const portrait = isPortrait(rotation);
  return {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: portrait ? '100vh' : '100vw',
    height: portrait ? '100vw' : '100vh',
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  };
}
