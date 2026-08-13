import test from 'node:test';
import assert from 'node:assert/strict';

import { consumeMmsFreeCalendarSlot } from '../../lib/admin/mms.js';

async function withMockMmsFetch(responses, action) {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.MMS_BEARER_TOKEN;
  const calls = [];
  process.env.MMS_BEARER_TOKEN = 'test-token-not-a-real-secret';
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: `${url}`, method: init.method || 'GET' });
    const response = responses[calls.length - 1];
    if (!response) throw new Error(`Unexpected MMS call ${calls.length}: ${url}`);
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      text: async () => response.body == null ? '' : JSON.stringify(response.body),
    };
  };

  try {
    return await action(calls);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.MMS_BEARER_TOKEN;
    else process.env.MMS_BEARER_TOKEN = originalToken;
  }
}

const selectedFreeEvent = {
  ID: 'evt_selected',
  StartDate: '2026-08-14T16:00:00',
  Duration: 30,
  TeacherID: 'tch_calum',
  EventCategory: { Name: 'Free' },
  Students: [],
  Attendances: [],
  SeriesID: 'series_free',
};

test('consumeMmsFreeCalendarSlot revalidates the exact event before deleting it', async () => {
  await withMockMmsFetch([
    { body: selectedFreeEvent },
    { status: 204, body: null },
  ], async (calls) => {
    const result = await consumeMmsFreeCalendarSlot({
      eventId: 'evt_selected',
      teacherId: 'tch_calum',
      lessonDate: '2026-08-14',
      lessonTime: '16:00',
      durationMinutes: 30,
    });

    assert.equal(result.eventId, 'evt_selected');
    assert.equal(result.seriesId, 'series_free');
    assert.deepEqual(calls, [
      {
        url: 'https://api.mymusicstaff.com/v1/calendar/events/evt_selected',
        method: 'GET',
      },
      {
        url: 'https://api.mymusicstaff.com/v1/calendar/event/evt_selected',
        method: 'DELETE',
      },
    ]);
  });
});

test('consumeMmsFreeCalendarSlot never deletes a changed event', async () => {
  await withMockMmsFetch([
    { body: { ...selectedFreeEvent, Duration: 45 } },
  ], async (calls) => {
    await assert.rejects(() => consumeMmsFreeCalendarSlot({
      eventId: 'evt_selected',
      teacherId: 'tch_calum',
      lessonDate: '2026-08-14',
      lessonTime: '16:00',
      durationMinutes: 30,
    }), /no longer matches the chosen lesson length/);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
  });
});

test('consumeMmsFreeCalendarSlot preserves MMS delete error detail for recovery', async () => {
  await withMockMmsFetch([
    { body: selectedFreeEvent },
    { ok: false, status: 409, body: { ErrorMessage: 'Event changed' } },
  ], async () => {
    await assert.rejects(() => consumeMmsFreeCalendarSlot({
      eventId: 'evt_selected',
      teacherId: 'tch_calum',
      lessonDate: '2026-08-14',
      lessonTime: '16:00',
      durationMinutes: 30,
    }), /MMS Free event removal failed: 409 - Event changed/);
  });
});
