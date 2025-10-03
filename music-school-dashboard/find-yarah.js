import mmsClient from './lib/mms-client.js';

async function findYarahLove() {
  const result = await mmsClient.getStudents();

  if (result.success) {
    const yarah = result.students.find(s =>
      s.name.toLowerCase().includes('love')
    );

    if (yarah) {
      console.log('✅ Found:', yarah.name, '(' + yarah.mms_id + ')');
      console.log('Status:', yarah.status);

      // Check billing profiles
      const fullResult = await mmsClient.fetchFromMMS('/search/students?offset=0&limit=500&fields=Family,StudentGroups,BillingProfiles,NextEventDate', 'POST', {}, { quiet: true });

      if (fullResult.success) {
        const student = fullResult.data.ItemSubset.find(s => s.ID === yarah.mms_id);

        console.log('\n📋 BillingProfiles:');
        student?.BillingProfiles?.forEach(bp => {
          const teacherName = bp.TeacherID === 'tch_C2bJ9' ? 'Fennella' :
                             bp.TeacherID === 'tch_zw9SJ3' ? 'Patrick' :
                             bp.TeacherID;
          console.log(`  ${teacherName} (${bp.TeacherID}) - ${bp.LessonDuration} min - Rate: £${bp.BillingRate}`);
        });

        // Get recent lessons
        const attendanceResult = await mmsClient.fetchFromMMS('/search/attendance', 'POST', {
          StudentIDs: [yarah.mms_id],
          Limit: 20,
          Offset: 0,
          OrderBy: '-EventStartDate'
        }, { quiet: true });

        console.log('\n📅 Lessons in Sept 10-16, 2025:');
        if (attendanceResult.success && attendanceResult.data?.ItemSubset) {
          const sept1016Lessons = attendanceResult.data.ItemSubset.filter(lesson => {
            const date = new Date(lesson.EventStartDate);
            return date >= new Date('2025-09-10') && date <= new Date('2025-09-16T23:59:59');
          });

          if (sept1016Lessons.length === 0) {
            console.log('  ❌ No lessons found in this date range');
          } else {
            sept1016Lessons.forEach(lesson => {
              const teacherName = lesson.TeacherID === 'tch_C2bJ9' ? 'Fennella' :
                                 lesson.TeacherID === 'tch_zw9SJ3' ? 'Patrick' :
                                 lesson.Teacher?.Name || lesson.TeacherID;
              console.log(`  ${lesson.EventStartDate} - ${teacherName} - ${lesson.EventDuration} min - ${lesson.AttendanceStatus}`);
            });
          }
        }
      }
    } else {
      console.log('❌ Not found with "love"');
    }
  }
}

findYarahLove();
