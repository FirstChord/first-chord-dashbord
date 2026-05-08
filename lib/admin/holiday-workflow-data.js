const COMMON_LINKS = {
  handbook: {
    label: 'Welcome handbook',
    href: 'https://firstchord.co.uk/handbook',
  },
};

const POLICY_POINTS = [
  'The school operates throughout bank holidays and the summer.',
  'There is a two-week school break over Christmas.',
  'If a family cancels with one week’s notice, that lesson is not charged.',
  'Lessons can usually be paused for a maximum of 3 weeks, except this policy does not apply over July and August.',
  'If a tutor cancels a lesson, payment should be paused for that lesson.',
];

const WORKFLOWS = {
  christmas: {
    label: 'Christmas break',
    title: 'Christmas Holiday Workflow 2026',
    subtitle: 'Two-week school closure and return-to-lessons coordination.',
    defaultWindow: 'Two-week closure over Christmas and New Year',
    timings: [
      { label: 'Tutor heads-up', value: '3–4 weeks before the final teaching week' },
      { label: 'Parent announcement', value: '2–3 weeks before the break' },
      { label: 'Restart reminder', value: '3–5 days before lessons resume' },
    ],
    templates: {
      parentAnnouncement: `Hey everyone! Hope you’re all excited about the festive period 🎄

We just wanted to clarify our Christmas closing dates. The whole school will be off from Monday 22nd December and then returning on January 5th. We’ll pause all recurring payments for that period, do let us know in your group chats if you’ll be away before/ after too. Looking forward to seeing you at the end of year show! ✨

Take care,

Finn & Tom`,
      tutorAnnouncement: `Hey everyone!

Just a heads-up that we’re starting Christmas planning for the two-week school break 🎄

Please let us know as soon as you can if there are any tutor holiday dates, final lesson changes, or special family circumstances we should factor into the run-up and restart.

We’ll also send the parent message shortly with the final dates.

Cheers!
Finn`,
      restartReminder: `Hey everyone!

Just a reminder that First Chord lessons resume this week after the Christmas break ✨

If anything has changed for your availability since the holidays, please let us know as soon as possible and we’ll do our best to help.

Looking forward to getting everyone going again!

Finn & Tom`,
    },
    taskGroups: [
      {
        id: 'dates',
        label: 'Dates & planning',
        tasks: [
          'Confirm the final lesson date before the Christmas break.',
          'Confirm the lesson restart date after the two-week break.',
          'Note any tutor holidays or special timetable constraints around shutdown and restart.',
        ],
      },
      {
        id: 'comms',
        label: 'Tutor & parent comms',
        tasks: [
          'Send the tutor heads-up message.',
          'Send the parent Christmas break announcement.',
          'Send the restart reminder before lessons resume.',
        ],
      },
      {
        id: 'ops',
        label: 'Operational checks',
        tasks: [
          'Review any students whose pause/payment state may need manual handling around the break.',
          'Record any known absences either side of the break.',
          'Confirm any timetable changes that affect the first week back.',
        ],
      },
    ],
  },
  easter: {
    label: 'Easter',
    title: 'Easter Workflow 2026',
    subtitle: 'Lessons normally continue across Easter and bank holidays unless families or tutors are away.',
    defaultWindow: 'Spring / Easter holiday reminder cycle',
    timings: [
      { label: 'Tutor reminder', value: '2–3 weeks before Easter weekend' },
      { label: 'Parent reminder', value: '1–2 weeks before Easter weekend' },
      { label: 'Follow-up', value: 'As needed for families or tutors who are away' },
    ],
    templates: {
      parentAnnouncement: `Hello!
Hope everyone is having a lovely day 😀 Easter is approaching, lessons however will be continuing as normal throughout April. We know you’ll be juggling many things so we’d like to remind you that our lesson cancellation policy is a minimum of *one week’s notice for payments to be paused*. If you are planning a holiday next week or any time over Easter, let us know ASAP in the lesson WhatsApp groups so we can update you lessons and payments. This applies to all bank holidays and the summer too. Christmas is our only 2 week break in the year. Thanks so much guys 💥.

Tom & Finn`,
      tutorAnnouncement: `Hey everyone!

Just a quick Easter reminder 🌼

The school is operating as normal through Easter and the bank holidays unless students or tutors are away.

Please let us know as soon as you can about any absences, holiday plans, or slot changes that need tracked so we can keep parents and payment expectations tidy.

Cheers!
Finn`,
      followUp: `Hey there!

Just checking in about Easter availability. If you already know you’ll be away for your usual lesson, please let us know as soon as possible and we’ll make a note of it.

Thanks!

Finn & Tom`,
    },
    taskGroups: [
      {
        id: 'availability',
        label: 'Availability checks',
        tasks: [
          'Ask tutors for any Easter holiday dates or unavailable slots.',
          'Collect known family absences over Easter or the bank holiday weekends.',
          'Track any students who may need a temporary pause or slot change.',
        ],
      },
      {
        id: 'comms',
        label: 'Reminders',
        tasks: [
          'Send the tutor Easter reminder.',
          'Send the parent Easter reminder.',
          'Follow up with any families who have not confirmed holiday plans where needed.',
        ],
      },
      {
        id: 'ops',
        label: 'Operational tidy-up',
        tasks: [
          'Review whether any Easter absences affect payment expectation or pause handling.',
          'Confirm any schedule changes with tutors.',
        ],
      },
    ],
  },
  summer: {
    label: 'Summer',
    title: 'Summer Holiday Workflow 2026',
    subtitle: 'The school stays open through July and August, but tutor and family holidays need active coordination.',
    defaultWindow: 'June to August availability and holiday planning',
    timings: [
      { label: 'Tutor availability collection', value: 'Start 4–6 weeks before the summer holiday period' },
      { label: 'Parent reminder', value: 'Start 3–5 weeks before key July/August dates' },
      { label: 'Follow-up', value: 'Continue as holiday plans change' },
    ],
    templates: {
      parentAnnouncement: `Hope everyone is doing great 😀! I just wanted to flag 🚩 that we are one week away from most mainstream schools in Glasgow beginning their summer holidays. As a reminder, we require one week notice to pause any lesson payments. So! To avoid any unnecessary payments being taken, please do give us you summer holiday plans asap ✅ (thanks if you already have 🫡). We shall be continuing lessons throughout the summer (though tutors may be off at various points for holidays). Summer can sometimes be a little different than the rest of the year in terms of schedule due to more folk being off. Thanks so much everyone in advance for your flexibility and your patience with having to deal with any _schedule tetris_ over the next few 🙏. Tom and I will be working hard to ensure everything runs smoothly. Please do fire any questions at all over to us in your WhatsApp.

Cheers!
Finn`,
      tutorAnnouncement: `Hey everyone!

We’re starting to plan summer availability ☀️

As usual, the school stays open throughout July and August, but we need a clear picture of tutor holidays, cover needs, and any families who are away.

Please send over your planned unavailable dates and flag any students whose summer plans you already know about.

Cheers!
Finn`,
      summerPauseReminder: `Hey there!

Just a quick check-in about summer lesson plans.

Lessons continue as normal through the summer unless you’re away, so if you already know your dates, just let us know and we’ll make a note of them.

Thanks!

Finn & Tom`,
    },
    taskGroups: [
      {
        id: 'availability',
        label: 'Tutor & family availability',
        tasks: [
          'Collect tutor holiday dates and unavailable weeks.',
          'Send the main summer parent reminder.',
          'Track families who are away and note the dates clearly.',
        ],
        guidance: [
          'The extended lesson break charging policy does not apply over July and August, but the school still needs a clear operational view of who is away.',
        ],
      },
      {
        id: 'ops',
        label: 'Schedule & payment handling',
        tasks: [
          'Review which students need temporary pause handling or manual expectation changes.',
          'Confirm any cover or slot changes needed because tutors are away.',
          'Follow up on unclear or long summer breaks so the student state stays accurate.',
        ],
      },
      {
        id: 'restart',
        label: 'End-of-summer tidy-up',
        tasks: [
          'Check that returning students are ready for their normal slot again.',
          'Follow up on any students whose summer absence has rolled into September.',
        ],
      },
    ],
  },
};

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
    guidance: group.guidance || [],
  }));
}

export function getHolidayWorkflow({ season = 'christmas', year = '2026' } = {}) {
  const definition = WORKFLOWS[season] || WORKFLOWS.christmas;

  return {
    season,
    seasonLabel: definition.label,
    year,
    title: definition.title.replace(/\b2026\b/u, year),
    subtitle: definition.subtitle,
    defaultWindow: definition.defaultWindow,
    commonLinks: COMMON_LINKS,
    policyPoints: POLICY_POINTS,
    timings: definition.timings || [],
    templates: definition.templates || {},
    taskGroups: normaliseTaskGroups(definition.taskGroups || []),
  };
}
