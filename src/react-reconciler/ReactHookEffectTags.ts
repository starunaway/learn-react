export enum HookFlags {
  NoFlags = /*   */ 0b0000,

  // Represents whether effect should fire.
  HasEffect = /* */ 0b0001,

  // Represents the phase in which the effect (not the clean-up) fires.
  Insertion = /*  */ 0b0010,
  Layout = /*    */ 0b0100,
  Passive = /*   */ 0b1000,
}
