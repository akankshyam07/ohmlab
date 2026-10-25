// Plain-language limits of the simulator, shown in the Lab's "About this simulator" disclosure.
// Keep in step with the Limitations section of docs/SIMULATION_SPEC.md.
export const SIM_LIMITATIONS: string[] = [
  'It shows the circuit once everything has settled (steady DC), not what happens over time.',
  'Batteries are ideal: they never sag under load and never run down.',
  "Parts don't heat up, and their behaviour doesn't change with temperature.",
  'A burnt part shows the current at the moment it fails. A real one usually breaks open, and then no current flows at all.',
  'Too much reverse voltage on an LED or diode gives a warning, but the simulator still blocks the current. A real part can break down and conduct.',
  'LED brightness is an approximation, not a measurement.',
]
