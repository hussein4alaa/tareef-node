// Run: TAREEF_BASE_URL=https://your-host TAREEF_API_KEY=frs_live_… node examples/quickstart.mjs
import { TareefClient, FaceAlreadyExistsError, NoFaceDetectedError } from 'tareef';

const tareef = new TareefClient(); // reads TAREEF_BASE_URL + TAREEF_API_KEY

// 1. Enroll someone from local files
try {
  const person = await tareef.register({
    name: 'Jane Doe',
    phone: '+15555550123',
    images: ['./jane-1.jpg', './jane-2.jpg'],
  });
  console.log('Enrolled:', person.uuid);
} catch (e) {
  if (e instanceof FaceAlreadyExistsError) console.log('Already enrolled as', e.uuid);
  else throw e;
}

// 2. Verify a new photo
try {
  const result = await tareef.verify('./unknown.jpg');
  if (result.success) {
    console.log(`Match: ${result.name} (score ${result.score})`);
  } else {
    console.log('No match:', result.status);
  }
} catch (e) {
  if (e instanceof NoFaceDetectedError) console.log('No face in the photo.');
  else throw e;
}

// 3. List people
const { people } = await tareef.listPeople({ limit: 50 });
console.log(`${people?.length ?? 0} people enrolled`);
