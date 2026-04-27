import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { normaliseInstrument } from '@/lib/admin/fc';
import { getAdminStudentByMmsId, updateAdminStudent } from '@/lib/admin/students';

const SHEETS_FIELD_MAP = {
  firstName: 'Student forename',
  lastName: 'Student Surname',
  tutor: 'Tutor',
  instrument: 'Instrument',
  lessonLength: 'Lesson length',
  parentFirstName: 'Parent forename',
  parentLastName: 'Parent surname',
  email: 'Email',
  contactNumber: 'Contact Number',
};

const REGISTRY_FIELD_MAP = {
  registryTutor: 'tutor',
  instrument: 'instrument',
  soundsliceUrl: 'soundsliceUrl',
  thetaUsername: 'thetaUsername',
};

function validatePayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Invalid request body'];
  }

  if (payload.thetaUsername && !/^[a-z0-9]+$/.test(payload.thetaUsername)) {
    errors.push('Theta username must be lowercase letters and numbers only');
  }

  if (payload.soundsliceUrl && !/^https:\/\/www\.soundslice\.com\/courses\/.+/.test(payload.soundsliceUrl)) {
    errors.push('Soundslice URL must be a valid Soundslice course URL');
  }

  return errors;
}

function mapUpdates(payload, mapping) {
  return Object.entries(mapping).reduce((acc, [inputKey, outputKey]) => {
    if (Object.prototype.hasOwnProperty.call(payload, inputKey)) {
      acc[outputKey] = inputKey === 'instrument' ? normaliseInstrument(payload[inputKey]) : payload[inputKey];
    }
    return acc;
  }, {});
}

export async function GET(_request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const student = await getAdminStudentByMmsId(params.mmsId);

  if (!student) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({ student });
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();
  const errors = validatePayload(payload);

  if (errors.length > 0) {
    return Response.json({ error: errors.join('. ') }, { status: 400 });
  }

  try {
    const student = await updateAdminStudent({
      mmsId: params.mmsId,
      sheetsUpdates: mapUpdates(payload, SHEETS_FIELD_MAP),
      registryUpdates: mapUpdates(payload, REGISTRY_FIELD_MAP),
    });

    if (!student) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json({ student });
  } catch (error) {
    return Response.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
}
