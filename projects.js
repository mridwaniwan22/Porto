/**
 * Portfolio Project Data
 * Edit this file to add, remove, or update projects without touching application code.
 *
 * Schema per project:
 * {
 *   id: string,
 *   title: string,
 *   years: string,
 *   code: string,
 *   roleNote: string[],
 *   mainImage: string | null,
 *   polaroidImage: string | null,
 *   bubblePages: string[]
 * }
 */

window.PROJECTS = [
  {
    id: 'kreditplus',
    title: 'Kreditplus',
    years: '2023-2025',
    code: 'F01KP',
    roleNote: ['Lead Designer', 'Lead Researcher'],
    mainImage: 'assets/placeholders/p1_main.svg',
    polaroidImage: 'assets/placeholders/p1_polaroid.svg',
    bubblePages: [
      'Kreditplus Mobile is a consumer finance mobile app. As lead designer, I helped create the design system, design principles, and more. I achieved a lot on this project.',
'As lead designer, I also conducted research and testing to improve performance, revenue, and user satisfaction.',
      'I also conduct research and testing as lead designer in order to improve performance, revenue, and user statisfaction',
    ]
  },
  {
    id: 'Fisiokeluarga',
    title: 'Fisiokeluarga',
    years: '2024',
    code: 'F02PG',
    roleNote: ['Team Leader','UI/UX Designer'],
    mainImage: 'assets/placeholders/p2_main.svg',
    polaroidImage: 'assets/placeholders/p2_polaroid.svg',
    bubblePages: [
      `Fisiokeluarga is a physiotherapy clinic, I worked with my team to help the owner develop a landing page, an online booking system, and a clinic management system.`, 
`It was a fun and unique project because we got to work on more than just a website, creating a complete digital solution to support the clinic's operations.`,
    ]
  },
  {
    id: 'Fisiokleuarga',
    title: 'Fisiokeluarga',
    years: '2025',
    code: 'F03TH',
    roleNote: ['UI/UX Designer', 'User Researcher'],
    mainImage: 'assets/placeholders/p3_main.svg',
    polaroidImage: 'assets/placeholders/p3_polaroid.svg',
    bubblePages: [
      'Transit Hub is a commuter rail planner built to replace confusing paper timetables for 65,000 daily riders across four metro lines.',
      'Live platform alerts and one-tap fare top-ups reduced ticket queue times by 38% during peak morning hours.'
    ]
  },
  {
    id: 'Starguide',
    title: 'Star Guide',
    years: '2023',
    code: 'F04EF',
    roleNote: ['Lead UX Designer', 'Prototyping'],
    mainImage: 'assets/placeholders/p4_main.svg',
    polaroidImage: 'assets/placeholders/p4_polaroid.svg',
    bubblePages: [
      'Enterprise Fleet Ops is a dispatch dashboard helping logistics coordinators track 1,400 delivery vans and resolve route delays faster.',
      'Consolidating twelve fragmented status screens into one map view cut average incident response time from 14 minutes to 4.'
    ]
  },
];