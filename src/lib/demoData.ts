// Sample "Jeremy-style" study days used before the real deck is imported.
// Every demo card has source = DEMO_SOURCE so it can be removed in one tap.

export const DEMO_SOURCE = "Demo (sample data)";

type DemoCard = { front: string; back: string; tags?: string };
type DemoDay = { day: number; title: string; domains: number[]; cards: DemoCard[] };

export const DEMO_DAYS: DemoDay[] = [
  {
    day: 1,
    title: "Network Devices",
    domains: [1],
    cards: [
      { front: "What is a network?", back: "A digital telecommunications network which allows nodes to share resources." },
      { front: "What is a <b>client</b>?", back: "A device that <b>accesses</b> a service made available by a server." },
      { front: "What is a <b>server</b>?", back: "A device that <b>provides</b> functions or services for clients." },
      { front: "What does a <b>switch</b> do, and which OSI layer does it operate at?", back: "Forwards frames between devices <i>within the same LAN</i>.<br>Layer 2 (Data Link)." },
      { front: "What does a <b>router</b> do?", back: "Forwards packets <i>between different networks</i> (LANs). Operates at Layer 3." },
      { front: "What is a <b>firewall</b>?", back: "A security device that monitors and controls network traffic based on configured rules.<ul><li>Network firewall: hardware appliance</li><li>Host-based firewall: software on a PC</li></ul>" },
      { front: "What is a <b>Next-Generation Firewall</b> (NGFW)?", back: "A firewall that adds advanced filtering such as deep packet inspection, application awareness and IPS." },
      { front: "Can a client also be a server?", back: "Yes — a device can be a client in one context and a server in another (e.g. a PC sharing files)." },
    ],
  },
  {
    day: 2,
    title: "Interfaces and Cables",
    domains: [1],
    cards: [
      { front: "What is the maximum length of a UTP Ethernet cable?", back: "100 meters." },
      { front: "Which pins does 10BASE-T/100BASE-TX use to <b>transmit</b> on a PC (MDI)?", back: "Pins <b>1 and 2</b> transmit, pins <b>3 and 6</b> receive." },
      { front: "When is a <b>crossover</b> cable needed?", back: "When connecting two devices of the same type (e.g. switch↔switch, router↔router, PC↔PC) without Auto MDI-X." },
      {
        front: "Match the Ethernet standard to its speed.",
        back: `<table><thead><tr><th>Standard</th><th>Speed</th><th>IEEE</th></tr></thead><tbody>
<tr><td>10BASE-T</td><td>10 Mbps</td><td>802.3i</td></tr>
<tr><td>100BASE-TX</td><td>100 Mbps</td><td>802.3u</td></tr>
<tr><td>1000BASE-T</td><td>1 Gbps</td><td>802.3ab</td></tr>
<tr><td>10GBASE-T</td><td>10 Gbps</td><td>802.3an</td></tr></tbody></table>`,
      },
      { front: "What does <b>Auto MDI-X</b> do?", back: "Detects which pins the neighbour transmits on and adjusts automatically, so either straight-through or crossover cables work." },
      { front: "Single-mode vs multimode fiber: which supports longer distances?", back: "<b>Single-mode</b> fiber (narrower core, laser-based) supports longer distances than multimode." },
      { front: "What does the 'T' in 1000BASE-T stand for?", back: "<b>Twisted pair</b> cabling." },
    ],
  },
  {
    day: 3,
    title: "OSI Model",
    domains: [1],
    cards: [
      {
        front: "List the 7 layers of the OSI model (top to bottom).",
        back: "<ol start=\"7\" reversed><li>Application</li><li>Presentation</li><li>Session</li><li>Transport</li><li>Network</li><li>Data Link</li><li>Physical</li></ol>",
      },
      { front: "What is the PDU at Layer 4?", back: "<b>Segment</b> (TCP) / Datagram (UDP)." },
      { front: "What is the PDU at Layer 3?", back: "<b>Packet</b>." },
      { front: "What is the PDU at Layer 2?", back: "<b>Frame</b>." },
      { front: "What is <b>encapsulation</b>?", back: "Adding headers (and trailers) as data moves <i>down</i> the layers before transmission." },
      { front: "Which OSI layer provides host-to-host communication and port numbers?", back: "Layer 4 — <b>Transport</b>." },
      { front: "Which OSI layer is responsible for logical addressing and path selection?", back: "Layer 3 — <b>Network</b>." },
      { front: "What is <b>same-layer interaction</b>?", back: "Each layer uses its own header to communicate with the same layer on the remote device." },
    ],
  },
  {
    day: 4,
    title: "TCP/IP Suite",
    domains: [1],
    cards: [
      { front: "Name the 4 layers of the TCP/IP model.", back: "Application, Transport, Internet, Link (Network Access)." },
      { front: "Which OSI layers map to the TCP/IP <b>Application</b> layer?", back: "Application, Presentation and Session (Layers 5–7)." },
      { front: "Which command enters privileged EXEC mode?", back: "enable" },
      { front: "Which command enters global configuration mode?", back: "configure terminal" },
      { front: "Which command saves the running configuration?", back: "copy running-config startup-config\n\n(or `write memory`)" },
      { front: "Which command encrypts all plaintext passwords in the config?", back: "service password-encryption" },
      { front: "What does the <code>enable secret</code> command use to protect the password?", back: "A hash (MD5 type 5 by default on many IOS versions) instead of reversible encryption." },
    ],
  },
  {
    day: 5,
    title: "Ethernet LAN Switching",
    domains: [1, 2],
    cards: [
      { front: "What are the fields of the Ethernet header?", back: "Preamble, SFD, Destination MAC, Source MAC, Type/Length." },
      { front: "How long is a MAC address?", back: "<b>48 bits</b> (6 bytes), written as 12 hex characters." },
      { front: "What is the <b>OUI</b>?", back: "The first 3 bytes of a MAC address — the Organizationally Unique Identifier assigned to the manufacturer." },
      { front: "What does a switch do with an <b>unknown unicast</b> frame?", back: "<b>Floods</b> it out of all interfaces except the one it was received on." },
      { front: "What is the minimum Ethernet frame size (header + payload + trailer)?", back: "<b>64 bytes</b> (payload minimum 46 bytes, padded if needed)." },
      { front: "What does the <b>FCS</b> do?", back: "Frame Check Sequence — a 4-byte CRC that detects corrupted frames." },
      { front: "How does a switch learn MAC addresses?", back: "By examining the <b>source</b> MAC address of received frames (dynamic learning)." },
      { front: "Default MAC address table aging time on Cisco switches?", back: "<b>5 minutes</b> (300 seconds)." },
    ],
  },
  {
    day: 6,
    title: "Ethernet LAN Switching Part 2",
    domains: [1, 2],
    cards: [
      { front: "What is the purpose of <b>ARP</b>?", back: "To discover the MAC address of a device when only its IP address is known." },
      { front: "Is an ARP Request broadcast or unicast?", back: "ARP Request: <b>broadcast</b> (FFFF.FFFF.FFFF).<br>ARP Reply: <b>unicast</b>." },
      { front: "Which command shows the ARP table on a Windows PC?", back: "arp -a" },
      { front: "Which command shows the MAC address table on a Cisco switch?", back: "show mac address-table" },
      { front: "How do you clear dynamic MAC addresses on a Cisco switch?", back: "clear mac address-table dynamic" },
      { front: "What Ethertype value indicates IPv4?", back: "<code>0x0800</code>" },
      { front: "What Ethertype value indicates ARP?", back: "<code>0x0806</code>" },
    ],
  },
  {
    day: 7,
    title: "IPv4 Addressing",
    domains: [1],
    cards: [
      { front: "How many bits are in an IPv4 address?", back: "<b>32 bits</b>." },
      { front: "What is the first-octet range of a <b>Class A</b> address?", back: "<b>1 – 126</b> (127 is reserved for loopback)." },
      { front: "What is the first-octet range of a <b>Class B</b> address?", back: "<b>128 – 191</b>, default mask /16." },
      { front: "What is the first-octet range of a <b>Class C</b> address?", back: "<b>192 – 223</b>, default mask /24." },
      { front: "Convert 11000000 to decimal.", back: "<b>192</b>" },
      { front: "What is the broadcast address of 192.168.1.0/24?", back: "192.168.1.255" },
      { front: "How do you configure an IP address on a router interface?", back: "```\nR1(config)# interface g0/0\nR1(config-if)# ip address 10.0.0.1 255.255.255.0\nR1(config-if)# no shutdown\n```" },
      { front: "Which command shows a summary of interfaces and their IP addresses?", back: "show ip interface brief" },
    ],
  },
  {
    day: 8,
    title: "IPv4 Header",
    domains: [1],
    cards: [
      { front: "What is the purpose of the <b>TTL</b> field?", back: "Prevents infinite loops — each router decrements it by 1, and the packet is dropped at 0." },
      { front: "What is the minimum IPv4 header length?", back: "<b>20 bytes</b> (IHL = 5)." },
      { front: "What is the protocol number for <b>TCP</b>?", back: "<b>6</b>" },
      { front: "What is the protocol number for <b>UDP</b>?", back: "<b>17</b>" },
      { front: "What is the protocol number for <b>OSPF</b>?", back: "<b>89</b>" },
      { front: "Which field identifies the IP version?", back: "The <b>Version</b> field (4 bits) — value 4 for IPv4." },
      { front: "What does the <b>DSCP</b> field do?", back: "Marks packets for QoS prioritization (first 6 bits of the ToS/DS byte)." },
    ],
  },
  {
    day: 9,
    title: "Ethernet Switching",
    domains: [2],
    cards: [
      { front: "What is the default speed/duplex setting on Cisco switch interfaces?", back: "<b>auto</b> / <b>auto</b> (autonegotiation)." },
      { front: "What does an interface status of <i>administratively down</i> mean?", back: "The interface was disabled with the <code>shutdown</code> command." },
      { front: "Which command shows interface status on a switch?", back: "show interfaces status" },
      { front: "What is a <b>runt</b>?", back: "A frame smaller than the minimum 64 bytes." },
      { front: "What is a <b>giant</b>?", back: "A frame larger than the maximum 1518 bytes." },
      { front: "What happens with a duplex mismatch?", back: "Late collisions and errors on the half-duplex side — degraded performance." },
      { front: "How do you configure a range of interfaces at once?", back: "SW1(config)# interface range f0/5 - 12" },
    ],
  },
  {
    day: 10,
    title: "Routing Fundamentals",
    domains: [3],
    cards: [
      { front: "Which route is selected when multiple routes match a destination?", back: "The <b>most specific</b> match (longest prefix length)." },
      { front: "What does a code <b>C</b> mean in the routing table?", back: "<b>Connected</b> route — the network of a configured interface." },
      { front: "What does a code <b>L</b> mean in the routing table?", back: "<b>Local</b> route — the exact /32 address configured on the interface." },
      { front: "Which command displays the routing table?", back: "show ip route" },
      { front: "What is the administrative distance of a static route?", back: "<b>1</b>" },
    ],
  },
  {
    day: 11,
    title: "Static Routing",
    domains: [3],
    cards: [
      { front: "Configure a static route to 192.168.4.0/24 via next hop 10.0.0.2.", back: "R1(config)# ip route 192.168.4.0 255.255.255.0 10.0.0.2" },
      { front: "What is a <b>default route</b>?", back: "A route to 0.0.0.0/0 — the least specific route, matching all destinations." },
      { front: "Configure a default route via 203.0.113.1.", back: "R1(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1" },
      { front: "What is a <b>floating static route</b>?", back: "A static route configured with a higher AD so it's only used as a backup." },
      { front: "What is the 'gateway of last resort'?", back: "The next hop of the default route, shown at the top of <code>show ip route</code>." },
    ],
  },
  {
    day: 12,
    title: "Subnetting",
    domains: [1],
    cards: [
      { front: "How many usable hosts are in a /26?", back: "2<sup>6</sup> − 2 = <b>62</b>" },
      { front: "What is the subnet mask for /27 in dotted decimal?", back: "255.255.255.<b>224</b>" },
      { front: "How many usable hosts are in a /30?", back: "<b>2</b> — common for point-to-point links." },
      { front: "What is the network address of 172.16.45.200/20?", back: "<b>172.16.32.0</b>" },
      { front: "How many /28 subnets fit in a /24?", back: "2<sup>4</sup> = <b>16</b>" },
    ],
  },
];

// Cards with no day tag, to demo the "Unassigned" bucket.
export const DEMO_UNASSIGNED: DemoCard[] = [
  { front: "What does <b>CSMA/CD</b> stand for?", back: "Carrier Sense Multiple Access with Collision Detection.", tags: "ethernet legacy" },
  { front: "What is the well-known port for HTTPS?", back: "TCP <b>443</b>", tags: "ports" },
  { front: "What is the well-known port for SSH?", back: "TCP <b>22</b>", tags: "ports" },
  { front: "What is a <b>collision domain</b>?", back: "A network segment where simultaneous transmissions can collide. Each switch port is its own collision domain.", tags: "ethernet" },
];
