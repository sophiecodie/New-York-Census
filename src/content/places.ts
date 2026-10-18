/**
 * MY NEW YORK: edit this file to make the photo map yours.
 *
 * 1. Put your photos in /public/photos (jpg/png/webp).
 * 2. Add a place below: a name, its [longitude, latitude] (right-click a spot in
 *    Google Maps to copy coordinates; Google shows "lat, lng", so swap the order),
 *    your photos, and a caption.
 * 3. The blue A line connects the places in the order you list them.
 *
 * Captions below are first drafts. Rewrite them in your own voice.
 */
export type Place = {
  id: string;
  name: string;
  neighborhood: string;
  at: [number, number]; // [longitude, latitude]
  photos: string[]; // e.g. "/photos/chinatown-1.jpg"
  caption: string;
  date?: string;
};

export const PLACES: Place[] = [
  {
    id: "wahi",
    name: "Washington Heights",
    neighborhood: "Manhattan",
    at: [-73.9378, 40.8461],
    photos: ["/photos/washington-heights-graduation.jpg"],
    caption: "Graduation day, sunflowers in hand, with my grandma beside me.",
    date: "June 2026",
  },
  {
    id: "central-park",
    name: "Central Park",
    neighborhood: "Manhattan",
    at: [-73.9649, 40.7917],
    photos: ["/photos/central-park-tennis.jpg"],
    caption: "The whole tennis team squeezed into one mirror at 96th Street.",
    date: "September 2025",
  },
  {
    id: "koreatown",
    name: "Koreatown",
    neighborhood: "Manhattan",
    at: [-73.9843, 40.7474],
    photos: ["/photos/koreatown-dinner.jpg"],
    caption: "Too many banchan, not enough table.",
    date: "February 2025",
  },
  {
    id: "west-village",
    name: "West Village",
    neighborhood: "Manhattan",
    at: [-74.0038, 40.7323],
    photos: ["/photos/west-village-snow.jpg"],
    caption: "First real snow of the winter, and everyone stopped to film it.",
    date: "January 2025",
  },
  {
    id: "hudson",
    name: "Hudson River Park",
    neighborhood: "Tribeca",
    at: [-74.0122, 40.7229],
    photos: [
      "/photos/hudson-2022-sunset.jpg",
      "/photos/hudson-2024-tennis.jpg",
      "/photos/hudson-2025-senior.jpg",
      "/photos/hudson-2026-summer.jpg",
    ],
    caption: "The railing by the river, from freshman-year sunsets to the last summer before college.",
    date: "2022–2026",
  },
  {
    id: "battery-park-city",
    name: "Battery Park City",
    neighborhood: "Manhattan",
    at: [-74.0167, 40.7157],
    photos: ["/photos/battery-park-city-prom.jpg"],
    caption: "Prom night: a red dress, a corsage, and flowers in hand.",
    date: "June 2026",
  },
  {
    id: "wtc",
    name: "World Trade Center",
    neighborhood: "Financial District",
    at: [-74.013, 40.7102],
    photos: ["/photos/wtc-boba.jpg"],
    caption: "Boba after dark under the towers.",
    date: "February 2025",
  },
  {
    id: "liberty",
    name: "Statue of Liberty",
    neighborhood: "New York Harbor",
    at: [-74.0425, 40.6876],
    photos: ["/photos/liberty-1.jpg", "/photos/liberty-2.jpg"],
    caption: "Dressed up on a boat in the harbor, with Lady Liberty lit up at sunset.",
    date: "June 2025",
  },
  {
    id: "seaport",
    name: "South Street Seaport",
    neighborhood: "Manhattan",
    at: [-74.0029, 40.7059],
    photos: ["/photos/seaport-1.jpg", "/photos/seaport-2.jpg"],
    caption: "Tall ships at dusk on the East River.",
    date: "February 2025",
  },
  {
    id: "manhattan-bridge",
    name: "Manhattan Bridge",
    neighborhood: "Manhattan → Brooklyn",
    at: [-73.9907, 40.7091],
    photos: ["/photos/manhattan-bridge-train.jpg", "/photos/subway-crew.jpg"],
    caption: "Every phone out the window when the train comes out over the river.",
    date: "October 2025",
  },
  {
    id: "brighton-beach",
    name: "Brighton Beach",
    neighborhood: "Brooklyn",
    at: [-73.9601, 40.5741],
    photos: ["/photos/brighton-beach.jpg"],
    caption: "Summer at the end of the line.",
    date: "July 2026",
  },
];
