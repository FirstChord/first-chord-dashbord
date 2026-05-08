const COMMON_LINKS = {
  venue: {
    label: 'Nemo Arts',
    href: 'https://maps.google.com/?q=Nemo+Arts+130+Bridgegate+Glasgow+G1+5HZ',
    detail: '130 Bridgegate, Glasgow, G1 5HZ',
  },
  eventbriteManage: {
    label: 'Eventbrite example / manage',
    href: 'https://www.eventbrite.co.uk/manage/events/1989006732680/details',
  },
  performerForm: {
    label: 'Performer submission form',
    href: 'https://docs.google.com/forms/d/1fUaaHgOGDrpo-JWTxd9rYqDnfY6LQyyzx09rwqQilZM/edit#responses',
  },
  runningOrderTemplate: {
    label: 'Canva show splits / running order template',
    href: 'https://www.canva.com/design/editor/shell?designId=DAGIY93bv-M&extension=fkg9rSLhuGeE5nufhZhcaA&mode=edit',
  },
  collageTemplate: {
    label: 'Canva collage template',
    href: 'https://www.canva.com/design/DAGJDPPKfGI/UsFwrB7C6H5i80W4Z0zqxg/edit',
  },
};

const SEASONAL_ASSETS = {
  summer: {
    label: 'Summer',
    icon: 'Sun',
    posterTemplate: {
      label: 'Summer poster template',
      href: 'https://www.canva.com/design/DAGEve9et8U/klmyImmT1Q1NuHB_dgEotQ/edit',
    },
    bannerTemplate: {
      label: 'Summer banner template',
      href: 'https://www.canva.com/design/DAGl7MsLsqU/vCM7G8vFbbFTVr3BPaS4kw/edit',
    },
    defaultWindow: 'Toward the end of June',
    parentAnnouncementTemplate: `Hey everyone!

We are really excited to announce our Summer Student Show for this year 🎶🌞🎉

It will be held at Nemo Arts, 130 Bridgegate, G1 5HZ, on Sunday DATE and is sure to be a great day!

Tickets are free, but please do book them through the Eventbrite link so we know numbers of people coming. Performers don’t need tickets 💥

We encourage all students to give it a go and play a song they’ve been working on, as it’s a great chance to connect with other folk who are learning.

More info soon. Thanks everyone, excited to see some great music!

Finn & Tom`,
    tutorAnnouncementTemplate: `Hey everyone!

The school show is coming soon 🌞

Most of you know the deal with how this works, but I’ll pop a more detailed message about it soon 💥

Main points:

Date: Sunday DATE
Location: Nemo Arts Studio
Format: 3 or 4 shows throughout the day

All students are welcome and encouraged to play. Have a chat with them over the coming weeks and see if they have a song they’d feel confident to perform.

As soon as they have decided, you can use the button I’ve added to the tutor dashboard to add their info and the song they are playing.

I’ll add a video below showing how to use the button.

Cheers!
Finn`,
  },
  winter: {
    label: 'Winter',
    icon: 'Snow',
    posterTemplate: {
      label: 'Winter poster template',
      href: 'https://www.canva.com/design/DAFwevNaOpE/JIc68DamTRKdlA45EZpxgQ/edit',
    },
    bannerTemplate: {
      label: 'Winter banner template',
      href: 'https://www.canva.com/design/DAFwezYp_Nc/cH3vU9nY8tN1pnjC_7Ok_Q/edit',
    },
    defaultWindow: 'Mid-December',
    parentAnnouncementTemplate: `Hey everyone!

We are really excited to announce our Winter Student Show for this year 🎶🎄🎉

It will be held at Nemo Arts, 130 Bridgegate, G1 5HZ, on Sunday DATE and is sure to be a great day!

Tickets are free, but please do book them through the Eventbrite link so we know numbers of people coming. Performers don’t need tickets 💥

We encourage all students to give it a go and play a song they’ve been working on, as it’s a great chance to connect with other folk who are learning.

More info soon. Thanks everyone, excited to see some great music!

Finn & Tom`,
    tutorAnnouncementTemplate: `Hey everyone!

The school show is coming soon 🎄

Most of you know the deal with how this works, but I’ll pop a more detailed message about it soon 💥

Main points:

Date: Sunday DATE
Location: Nemo Arts Studio
Format: 3 or 4 shows throughout the day

All students are welcome and encouraged to play. Have a chat with them over the coming weeks and see if they have a song they’d feel confident to perform.

As soon as they have decided, you can use the button I’ve added to the tutor dashboard to add their info and the song they are playing.

I’ll add a video below showing how to use the button.

Cheers!
Finn`,
  },
};

const TEMPLATES = {
  parentFollowUp: `Tickets can be grabbed by scanning the QR code above or by following this link:

EVENTBRITE LINK`,
  tutorHelperRequest: `Hey everyone!

Tom and I are getting all set for the show 🎭

We are looking for extra hands, with 3–4 two-hour shifts going. These would be paid at £12.20 per hour.

Would anyone be keen to come along on the day to help out? This would involve shepherding students around, tuning guitars, serving snacks etc.

We’ll ideally get you to come along when the bulk of your students are playing.

Would be lovely to see as many of you as possible, even if you’re just popping along to spectate and support your students.

Cheers!
Finn`,
  runningOrderMessage: `Hey everyone!

We’re looking forward to the show and now have the running order ready.

Please find your show time below. We’d recommend arriving a little before your slot so everyone has time to get settled.

Venue: Nemo Arts, 130 Bridgegate, G1 5HZ

Show times / running order:
[INSERT RUNNING ORDER OR IMAGE HERE]

A reminder that performers do not need a ticket, but audience members should still book a free ticket through Eventbrite so we have an idea of numbers.

Thanks everyone and looking forward to a great day!

Finn & Tom`,
  parentThankYou: `Hey everyone!

Just wanted to say a massive well done to everyone who performed at the show today. It was brilliant seeing so many students getting up and playing, and we really appreciate everyone coming along and supporting them.

Thanks again from all of us at First Chord!

Finn & Tom`,
};

const TASK_GROUPS = [
  {
    id: 'planning',
    label: 'Planning',
    tasks: [
      'Book Nemo Arts and confirm access times.',
      'Decide final date and expected number of shows.',
      'Set parent announcement date, tutor announcement date, submission deadline, and helper schedule deadline.',
    ],
  },
  {
    id: 'assets',
    label: 'Poster & Eventbrite',
    tasks: [
      'Update the Canva poster template.',
      'Update the Canva Eventbrite banner.',
      'Duplicate or create the Eventbrite event.',
      'Copy the Eventbrite link, generate the QR code, and add it to the poster.',
    ],
  },
  {
    id: 'announcements',
    label: 'Announcements',
    tasks: [
      'Send first parent announcement in the WhatsApp Community Group.',
      'Send the parent follow-up message with the Eventbrite link.',
      'Send the first tutor announcement in the Tutor WhatsApp Group.',
      'Schedule tutor reminders every 2 weeks until the submission deadline.',
      'Send the tutor helper request 2–3 weeks before the show.',
    ],
  },
  {
    id: 'submissions',
    label: 'Performer Collection',
    tasks: [
      'Monitor Google Form responses for performer submissions.',
      'Check names, tutor, instrument, song title, and completeness.',
      'Watch for duplicates or unclear submissions.',
      'Lock submissions 2 weeks before the show.',
    ],
  },
  {
    id: 'show-build',
    label: 'Show Splits & Running Order',
    tasks: [
      'Split performers into 3–4 shows.',
      'Keep siblings together where possible.',
      'Spread tutors sensibly across the day.',
      'Balance show lengths and confidence levels.',
      'Create final running orders and Canva split graphics.',
      'Send final running orders to parents.',
    ],
  },
  {
    id: 'logistics',
    label: 'Logistics & Helpers',
    tasks: [
      'Prepare helper shift schedule at least 1 week before the show.',
      'Check equipment list and venue requirements.',
      'Print flyers and any signage or running orders needed.',
      'Decide how to encourage reviews after the show.',
    ],
  },
  {
    id: 'show-day',
    label: 'Show Day',
    tasks: [
      'Confirm access and arrive early for setup.',
      'Check equipment, running order, and student arrivals before each show.',
      'Assign roles: intro, check-in, running order, student support, tech, photos/videos.',
      'Capture photos and videos throughout the day.',
      'Pack down, thank venue staff, and note anything to improve.',
    ],
  },
  {
    id: 'follow-up',
    label: 'After the Show',
    tasks: [
      'Share photos/videos/collages in the Community Groups.',
      'Send the parent thank-you message.',
      'Add selected photos and a recap to the newsletter.',
      'Write a quick internal review for next time.',
    ],
  },
];

const TIMINGS = [
  { label: 'Parent announcement', value: '5–6 weeks before the show' },
  { label: 'Tutor announcement', value: 'At least 6 weeks before the show' },
  { label: 'Tutor reminders', value: 'Every 2 weeks leading up to the show' },
  { label: 'Tutor helper request', value: '2–3 weeks before the show' },
  { label: 'Performer deadline', value: '2 weeks before the show' },
  { label: 'Helper shift schedule', value: 'At least 1 week before the show' },
];

function slugifyTaskId(value = '') {
  return `${value || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normaliseTaskGroups(taskGroups = []) {
  return taskGroups.map((group) => ({
    ...group,
    tasks: (group.tasks || []).map((task, index) => ({
      id: `${group.id}-${slugifyTaskId(task) || `task-${index + 1}`}`,
      label: task,
    })),
  }));
}

export function getShowcaseWorkflow({ season = 'summer', year = '2026' } = {}) {
  const selectedSeason = SEASONAL_ASSETS[season] ? season : 'summer';
  const seasonal = SEASONAL_ASSETS[selectedSeason];

  return {
    title: `${seasonal.label} Show ${year}`,
    season: selectedSeason,
    year,
    seasonLabel: seasonal.label,
    seasonIcon: seasonal.icon,
    defaultWindow: seasonal.defaultWindow,
    timings: TIMINGS,
    commonLinks: COMMON_LINKS,
    seasonalAssets: seasonal,
    templates: TEMPLATES,
    taskGroups: normaliseTaskGroups(TASK_GROUPS),
  };
}
