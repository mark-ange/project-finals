export interface SeedEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  image: string;
  category: string;
  description: string;
  summary: string;
  location: string;
  organizer: string;
  department: string;
  capacity: number;
  status: 'active' | 'inactive' | 'draft';
}

export const DEFAULT_EVENTS: SeedEvent[] = [
  {
    id: 'ev-1',
    title: 'Outstanding Success for G9 and G10 German Language Learners!',
    date: 'March 21, 2026',
    time: '9:00 AM - 12:00 PM',
    image: 'https://images.unsplash.com/photo-1546430498-05c7b920bf0a?auto=format&fit=crop&w=1200&q=80',
    category: 'Academic',
    description: 'Herzlichen Gluckwunsch to our G9 and G10 students who demonstrated extraordinary competency in the German language certification testing.',
    summary: 'Outstanding German Language Certification Success.',
    location: 'Rodelsa Hall',
    organizer: 'Liceo de Cagayan University',
    department: 'Main Administration',
    capacity: 200,
    status: 'active'
  },
  {
    id: 'ev-2',
    title: 'Internationalization Days 71st Founding Anniversary',
    date: 'February 28, 2026',
    time: '8:00 AM - 5:00 PM',
    image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80',
    category: 'Social',
    description: 'Foreign students took the initiative to organize the Internationalization Event, leading intercultural activities that highlighted diversity, food booths, henna tattoos, and an Open Mic Singing Activity.',
    summary: 'Celebrating diversity and global engagement through food and arts.',
    location: 'Main Campus',
    organizer: 'International Students Committee',
    department: 'Main Administration',
    capacity: 500,
    status: 'active'
  },
  {
    id: 'ev-3',
    title: 'LICEO SHS RESEARCHERS DOMINATE 8TH JOSENIAN SUMMIT',
    date: 'February 18, 2026',
    time: '1:00 PM - 5:00 PM',
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
    category: 'Academic',
    description: 'Liceo SHS Researchers proudly dominate the 8th Josenian Summit and bag multiple awards for their exceptional research presentations.',
    summary: 'Liceo Researchers bag multiple awards at summit.',
    location: 'Virtual / Main Campus',
    organizer: 'SHS Research Department',
    department: 'Student Affairs Department',
    capacity: 100,
    status: 'active'
  },
  {
    id: 'ev-4',
    title: 'Goethe-Institut Philippinen Delegates Courtesy Call',
    date: 'December 15, 2025',
    time: '10:00 AM - 12:00 PM',
    image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80',
    category: 'Seminar',
    description: 'Courtesy Call and Culmination Meeting with Goethe-Institut Philippinen Delegates for the Science Film Festival 2025 focusing on Green Jobs.',
    summary: 'Meeting with Goethe-Institut delegates for Green Jobs initiative.',
    location: 'Rodelsa Hall',
    organizer: 'Office of International Relations and Linkages',
    department: 'Main Administration',
    capacity: 150,
    status: 'active'
  },
  {
    id: 'ev-5',
    title: 'LICEAN CAMPUS JOURNOS WIN BIG AT NCPS 2025',
    date: 'December 04, 2025',
    time: '8:00 AM - 4:00 PM',
    image: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80',
    category: 'Workshop',
    description: 'Liceo de Cagayan University SHS campus journalists secured major awards at Explained PH\'s 2025 National Campus Press Summit (NCPS).',
    summary: 'Campus Press Summit major award victors.',
    location: 'Liceo Civic Center',
    organizer: 'Student Affairs',
    department: 'Fine Arts Department',
    capacity: 250,
    status: 'active'
  },
  {
    id: 'ev-6',
    title: 'Green Jobs & Science Film Fest',
    date: 'November 29, 2025',
    time: '9:00 AM - 3:00 PM',
    image: 'https://images.unsplash.com/photo-1497215848529-651239aa841c?auto=format&fit=crop&w=1200&q=80',
    category: 'Seminar',
    description: 'Liceo U and Goethe-Institut boost partnership via Green Jobs and the Science Film Fest, exploring climate awareness and sustainable cooperation.',
    summary: 'Promotion of climate awareness and sustainable cooperation.',
    location: 'Liceo Civic Center (LCC)',
    organizer: 'Office of International Relations',
    department: 'Information Technology Department',
    capacity: 300,
    status: 'active'
  }
];
