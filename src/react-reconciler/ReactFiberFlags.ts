export enum Flags {
  NoFlags = /*                      */ 0b00000000000000000000000000,
  PerformedWork = /*                */ 0b00000000000000000000000001,
  Placement = /*                    */ 0b00000000000000000000000010,
  Update = /*                       */ 0b00000000000000000000000100,
  Deletion = /*                     */ 0b00000000000000000000001000,
  ChildDeletion = /*                */ 0b00000000000000000000010000,
  ContentReset = /*                 */ 0b00000000000000000000100000,
  Callback = /*                     */ 0b00000000000000000001000000,
  DidCapture = /*                   */ 0b00000000000000000010000000,
  ForceClientRender = /*            */ 0b00000000000000000100000000,
  Ref = /*                          */ 0b00000000000000001000000000,
  Snapshot = /*                     */ 0b00000000000000010000000000,
  Passive = /*                      */ 0b00000000000000100000000000,
  Hydrating = /*                    */ 0b00000000000001000000000000,
  Visibility = /*                   */ 0b00000000000010000000000000,
  StoreConsistency = /*             */ 0b00000000000100000000000000,
  HostEffectMask = /*               */ 0b00000000000111111111111111,
  Incomplete = /*                   */ 0b00000000001000000000000000,
  ShouldCapture = /*                */ 0b00000000010000000000000000,
  ForceUpdateForLegacySuspense = /* */ 0b00000000100000000000000000,
  DidPropagateContext = /*          */ 0b00000001000000000000000000,
  NeedsPropagation = /*             */ 0b00000010000000000000000000,
  Forked = /*                       */ 0b00000100000000000000000000,

  RefStatic = /*                    */ 0b00001000000000000000000000,
  LayoutStatic = /*                 */ 0b00010000000000000000000000,
  PassiveStatic = /*                */ 0b00100000000000000000000000,
}

export const LifecycleEffectMask =
  Flags.Passive |
  Flags.Update |
  Flags.Callback |
  Flags.Ref |
  Flags.Snapshot |
  Flags.StoreConsistency;

export const MutationMask =
  Flags.Placement |
  Flags.Update |
  Flags.ChildDeletion |
  Flags.ContentReset |
  Flags.Ref |
  Flags.Hydrating |
  Flags.Visibility;
export const LayoutMask = Flags.Update | Flags.Callback | Flags.Ref | Flags.Visibility;

export const BeforeMutationMask =
  // TODO: Remove Update flag from before mutation phase by re-landing Visibility
  // flag logic (see #20043)
  Flags.Update | Flags.Snapshot;
