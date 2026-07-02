"use client";

import { create } from "zustand";

export type TenantView =
  | "dashboard"
  | "customers"
  | "promos"
  | "insights"
  | "settings";

export type AdminView = "prospects" | "broadcasts" | "webhooks";

export type Mode = "tenant" | "admin";

export type PublicOverlay = null | "claim" | "geo-claim" | "welcome";
export type AuthOverlay = null | "login" | "signup";
export type LegalOverlay = null | "privacy" | "terms";

interface FlavourlyState {
  // Navigation
  mode: Mode;
  tenantView: TenantView;
  adminView: AdminView;
  publicOverlay: PublicOverlay;
  authOverlay: AuthOverlay;
  legalOverlay: LegalOverlay;

  // Context
  activeTenantId: string | null;
  // For claim/geo-claim demos
  claimToken: string | null;
  geoClaimEventId: string | null;

  // Actions
  setMode: (m: Mode) => void;
  setTenantView: (v: TenantView) => void;
  setAdminView: (v: AdminView) => void;
  openPublic: (o: PublicOverlay, payload?: { token?: string; eventId?: string }) => void;
  closePublic: () => void;
  openAuth: (o: AuthOverlay) => void;
  closeAuth: () => void;
  openLegal: (o: LegalOverlay) => void;
  closeLegal: () => void;
  setActiveTenant: (id: string | null) => void;
  reset: () => void;
}

export const useFlavourly = create<FlavourlyState>((set) => ({
  mode: "tenant",
  tenantView: "dashboard",
  adminView: "prospects",
  publicOverlay: null,
  authOverlay: null,
  legalOverlay: null,
  activeTenantId: null,
  claimToken: null,
  geoClaimEventId: null,

  setMode: (m) => set({ mode: m }),
  setTenantView: (v) => set({ tenantView: v, mode: "tenant" }),
  setAdminView: (v) => set({ adminView: v, mode: "admin" }),
  openPublic: (o, payload) =>
    set({
      publicOverlay: o,
      claimToken: payload?.token ?? null,
      geoClaimEventId: payload?.eventId ?? null,
    }),
  closePublic: () => set({ publicOverlay: null, claimToken: null, geoClaimEventId: null }),
  openAuth: (o) => set({ authOverlay: o }),
  closeAuth: () => set({ authOverlay: null }),
  openLegal: (o) => set({ legalOverlay: o }),
  closeLegal: () => set({ legalOverlay: null }),
  setActiveTenant: (id) => set({ activeTenantId: id }),
  reset: () =>
    set({
      mode: "tenant",
      tenantView: "dashboard",
      adminView: "prospects",
      publicOverlay: null,
      authOverlay: null,
      legalOverlay: null,
    }),
}));
