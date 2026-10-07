// Static CCNA 200-301 metadata and Jeremy's IT Lab course outline.

export const DAY_STATUSES = ["ACTIVE", "REVIEW_ONLY", "PAUSED"] as const;
export type DayStatusValue = (typeof DAY_STATUSES)[number];

export const DAY_STATUS_LABEL: Record<DayStatusValue, string> = {
  ACTIVE: "Active",
  REVIEW_ONLY: "Review Only",
  PAUSED: "Paused",
};

export const CCNA_DOMAINS = [
  { id: 1, key: "fundamentals", name: "Network Fundamentals", examWeight: 20, sortOrder: 1 },
  { id: 2, key: "access", name: "Network Access", examWeight: 20, sortOrder: 2 },
  { id: 3, key: "ip-connectivity", name: "IP Connectivity", examWeight: 25, sortOrder: 3 },
  { id: 4, key: "ip-services", name: "IP Services", examWeight: 10, sortOrder: 4 },
  { id: 5, key: "security", name: "Security Fundamentals", examWeight: 15, sortOrder: 5 },
  { id: 6, key: "automation", name: "Automation and Programmability", examWeight: 10, sortOrder: 6 },
] as const;

const F = 1, A = 2, C = 3, S = 4, SEC = 5, AU = 6;

/**
 * Jeremy's IT Lab CCNA course days → default title and CCNA domain(s).
 * Used when an import creates a study day that doesn't exist yet.
 * Titles are only defaults — they are editable in the Study Plan.
 */
export const JEREMY_DAYS: Record<number, { title: string; domains: number[] }> = {
  1: { title: "Network Devices", domains: [F] },
  2: { title: "Interfaces and Cables", domains: [F] },
  3: { title: "OSI Model & TCP/IP Suite", domains: [F] },
  4: { title: "Intro to the CLI", domains: [F] },
  5: { title: "Ethernet LAN Switching (Part 1)", domains: [F, A] },
  6: { title: "Ethernet LAN Switching (Part 2)", domains: [F, A] },
  7: { title: "IPv4 Addressing (Part 1)", domains: [F] },
  8: { title: "IPv4 Addressing (Part 2)", domains: [F] },
  9: { title: "Switch Interfaces", domains: [F, A] },
  10: { title: "The IPv4 Header", domains: [F] },
  11: { title: "Routing Fundamentals", domains: [C] },
  12: { title: "Static Routing", domains: [C] },
  13: { title: "Life of a Packet", domains: [F, C] },
  14: { title: "Subnetting (Part 1)", domains: [F] },
  15: { title: "Subnetting (Part 2)", domains: [F] },
  16: { title: "Subnetting (Part 3 – VLSM)", domains: [F] },
  17: { title: "VLANs (Part 1)", domains: [A] },
  18: { title: "VLANs (Part 2)", domains: [A] },
  19: { title: "VLANs (Part 3)", domains: [A] },
  20: { title: "Dynamic Trunking Protocol", domains: [A] },
  21: { title: "Spanning Tree Protocol (Part 1)", domains: [A] },
  22: { title: "Spanning Tree Protocol (Part 2)", domains: [A] },
  23: { title: "Rapid Spanning Tree Protocol", domains: [A] },
  24: { title: "EtherChannel", domains: [A] },
  25: { title: "Dynamic Routing", domains: [C] },
  26: { title: "RIP & EIGRP", domains: [C] },
  27: { title: "OSPF (Part 1)", domains: [C] },
  28: { title: "OSPF (Part 2)", domains: [C] },
  29: { title: "OSPF (Part 3)", domains: [C] },
  30: { title: "First Hop Redundancy Protocols", domains: [C] },
  31: { title: "TCP & UDP", domains: [F] },
  32: { title: "IPv6 (Part 1)", domains: [F] },
  33: { title: "IPv6 (Part 2)", domains: [F] },
  34: { title: "IPv6 (Part 3)", domains: [F, C] },
  35: { title: "Standard ACLs", domains: [SEC] },
  36: { title: "Extended ACLs", domains: [SEC] },
  37: { title: "CDP & LLDP", domains: [A] },
  38: { title: "NTP", domains: [S] },
  39: { title: "DNS", domains: [S] },
  40: { title: "DHCP", domains: [S] },
  41: { title: "SNMP", domains: [S] },
  42: { title: "Syslog", domains: [S] },
  43: { title: "SSH", domains: [S, SEC] },
  44: { title: "FTP & TFTP", domains: [S] },
  45: { title: "NAT (Part 1)", domains: [S] },
  46: { title: "NAT (Part 2)", domains: [S] },
  47: { title: "QoS (Part 1)", domains: [S] },
  48: { title: "QoS (Part 2)", domains: [S] },
  49: { title: "Security Fundamentals", domains: [SEC] },
  50: { title: "Port Security", domains: [SEC] },
  51: { title: "DHCP Snooping", domains: [SEC] },
  52: { title: "Dynamic ARP Inspection", domains: [SEC] },
  53: { title: "LAN Architectures", domains: [F] },
  54: { title: "WAN Architectures", domains: [F] },
  55: { title: "Virtualization & Cloud", domains: [F] },
  56: { title: "Wireless Fundamentals", domains: [F, A] },
  57: { title: "Wireless Architectures", domains: [A] },
  58: { title: "Wireless Security", domains: [SEC] },
  59: { title: "Wireless Configuration", domains: [A, SEC] },
  60: { title: "Network Automation", domains: [AU] },
  61: { title: "JSON, XML & YAML", domains: [AU] },
  62: { title: "REST APIs", domains: [AU] },
  63: { title: "Software-Defined Networking", domains: [AU] },
  64: { title: "Ansible, Puppet & Chef", domains: [AU] },
};

export function defaultDayTitle(dayNumber: number): string {
  return JEREMY_DAYS[dayNumber]?.title ?? `Day ${dayNumber}`;
}

export function defaultDayDomains(dayNumber: number): number[] {
  return JEREMY_DAYS[dayNumber]?.domains ?? [];
}

export const DEFAULT_SOURCE = "Jeremy's IT Lab";
