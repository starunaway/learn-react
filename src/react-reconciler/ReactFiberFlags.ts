export type Flags = number;

// todo 暂时可以先不看?
// Don't change these values. They're used by React Dev Tools.
export const NoFlags = /*                      */ 0b0000000000000000000000000000;
export const PerformedWork = /*                */ 0b0000000000000000000000000001;
export const Placement = /*                    */ 0b0000000000000000000000000010;
export const DidCapture = /*                   */ 0b0000000000000000000010000000;
export const Hydrating = /*                    */ 0b0000000000000001000000000000;

// You can change the rest (and add more).
export const Update = /*                       */ 0b0000000000000000000000000100;
/* Skipped value:                                 0b0000000000000000000000001000; */

export const ChildDeletion = /*                */ 0b0000000000000000000000010000;
export const ContentReset = /*                 */ 0b0000000000000000000000100000;
export const Callback = /*                     */ 0b0000000000000000000001000000;
/* Used by DidCapture:                            0b0000000000000000000010000000; */

export const ForceClientRender = /*            */ 0b0000000000000000000100000000;
export const Ref = /*                          */ 0b0000000000000000001000000000;
export const Snapshot = /*                     */ 0b0000000000000000010000000000;
export const Passive = /*                      */ 0b0000000000000000100000000000;
/* Used by Hydrating:                             0b0000000000000001000000000000; */

export const Visibility = /*                   */ 0b0000000000000010000000000000;
export const StoreConsistency = /*             */ 0b0000000000000100000000000000;

export const PassiveMask = Passive | ChildDeletion;
