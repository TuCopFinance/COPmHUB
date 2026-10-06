import { describe, expect, it } from "vitest";
import { serviceLinkProps, services, type Service } from "./services";

const liveExternal: Service = {
  id: "cards",
  name: "Cards",
  description: "x",
  href: "https://cards.digitalcop.shop",
  cta: "Comprar COPm con pesos",
  status: "live",
  external: true,
};

const soon: Service = {
  id: "tucop",
  name: "Soon",
  description: "x",
  href: "#",
  cta: "Pronto",
  status: "soon",
  external: false,
};

const liveInternal: Service = {
  id: "copby",
  name: "Internal",
  description: "x",
  href: "/algo",
  cta: "Ver",
  status: "live",
  external: false,
};

describe("serviceLinkProps", () => {
  it("opens live external services in a new tab with safe rel", () => {
    expect(serviceLinkProps(liveExternal)).toEqual({
      href: "https://cards.digitalcop.shop",
      target: "_blank",
      rel: "noopener noreferrer",
      isLink: true,
    });
  });

  it("renders soon services as non-links", () => {
    expect(serviceLinkProps(soon)).toEqual({
      href: undefined,
      target: undefined,
      rel: undefined,
      isLink: false,
    });
  });

  it("keeps live internal services same-tab", () => {
    expect(serviceLinkProps(liveInternal)).toEqual({
      href: "/algo",
      target: undefined,
      rel: undefined,
      isLink: true,
    });
  });
});

describe("services copy", () => {
  it("uses verb CTAs instead of raw URLs", () => {
    for (const service of services) {
      expect(service.cta.length).toBeGreaterThan(3);
      expect(service.cta).not.toMatch(/https?:\/\//);
      expect(service.cta).not.toMatch(/digitalcop\.shop/);
    }
  });

  it("marks Neeru as partner and avoids a guaranteed-yield claim", () => {
    const neeru = services.find((service) => service.id === "neeru");
    expect(neeru?.partner).toBe(true);
    expect(neeru?.description.toLowerCase()).toContain("partner");
    expect(neeru?.description.toLowerCase()).not.toContain("cada dia");
    expect(neeru?.description.toLowerCase()).not.toContain("cada día");
  });

  it("lists Arc to COPm with a direct integration contact", () => {
    const arc = services.find((service) => service.id === "arc");

    expect(arc).toMatchObject({
      name: "Arc → COPm",
      tag: "Infraestructura",
      cta: "Explorar Arc → COPm",
      contact: {
        label: "Hablar con el equipo",
        href: expect.stringContaining("https://t.me/CeloCol?text="),
      },
    });
  });
});
