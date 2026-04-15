// Generate Payroll Report for a specific tutor
import mmsClient from './lib/mms-client.js';

const TUTOR_HOURLY_RATE = 24; // £24 per hour

async function generatePayrollReport(tutorName, startDate, endDate) {
  console.log(`\n📊 Payroll Report for ${tutorName}`);
  console.log(`Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
  console.log(`Rate: £${TUTOR_HOURLY_RATE}/hour`);
  console.log('='.repeat(80) + '\n');

  // Get tutor's students
  const studentsResult = await mmsClient.getStudentsForTeacher(tutorName);

  if (!studentsResult.success) {
    console.error(`❌ Error: ${studentsResult.message}`);
    return;
  }

  console.log(`Found ${studentsResult.students.length} students assigned to ${tutorName}\n`);

  // Fetch attendance for each student in the date range
  const allLessons = [];

  for (const student of studentsResult.students) {
    console.log(`Fetching attendance for ${student.name} (${student.mms_id})...`);

    const endpoint = '/search/attendance';
    const body = {
      StudentIDs: [student.mms_id],
      Limit: 50, // Get more records to cover date range
      Offset: 0,
      OrderBy: '-EventStartDate'
    };

    const result = await mmsClient.fetchFromMMS(endpoint, 'POST', body, { quiet: true });

    if (result.success && result.data && result.data.ItemSubset) {
      // Filter for lessons in date range with tutor
      const lessonsInRange = result.data.ItemSubset.filter(record => {
        const lessonDate = new Date(record.EventStartDate);
        const isInRange = lessonDate >= startDate && lessonDate <= endDate;
        const isTutorMatch = record.TeacherID === studentsResult.teacherId;
        const wasPresent = record.AttendanceStatus === 'Present';

        return isInRange && isTutorMatch && wasPresent;
      });

      if (lessonsInRange.length > 0) {
        console.log(`  ✅ Found ${lessonsInRange.length} lessons in date range`);

        lessonsInRange.forEach(lesson => {
          allLessons.push({
            studentName: student.name,
            studentId: student.mms_id,
            date: new Date(lesson.EventStartDate),
            duration: lesson.EventDuration,
            status: lesson.AttendanceStatus,
            notes: lesson.StudentNote ? 'Yes' : 'No'
          });
        });
      } else {
        console.log(`  ⚪ No lessons in date range`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📋 Lessons Summary\n`);

  if (allLessons.length === 0) {
    console.log('❌ No lessons found in this date range\n');
    return;
  }

  // Sort lessons by date
  allLessons.sort((a, b) => a.date - b.date);

  // Display lessons
  let totalMinutes = 0;
  console.log('Date                  | Student                    | Duration | Notes');
  console.log('-'.repeat(80));

  allLessons.forEach(lesson => {
    const dateStr = lesson.date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const studentNamePadded = lesson.studentName.padEnd(26);
    const durationStr = `${lesson.duration} min`.padEnd(8);

    console.log(`${dateStr.padEnd(20)} | ${studentNamePadded} | ${durationStr} | ${lesson.notes}`);
    totalMinutes += lesson.duration;
  });

  console.log('-'.repeat(80));

  // Calculate payment
  const totalHours = totalMinutes / 60;
  const totalPayment = totalHours * TUTOR_HOURLY_RATE;

  console.log(`\n💰 Payment Calculation\n`);
  console.log(`Total Lessons:     ${allLessons.length}`);
  console.log(`Total Minutes:     ${totalMinutes} min`);
  console.log(`Total Hours:       ${totalHours.toFixed(2)} hours`);
  console.log(`Hourly Rate:       £${TUTOR_HOURLY_RATE}/hour`);
  console.log(`\n─────────────────────────────`);
  console.log(`TOTAL PAYMENT:     £${totalPayment.toFixed(2)}`);
  console.log(`─────────────────────────────\n`);

  // Breakdown by student
  console.log(`\n📊 Breakdown by Student\n`);
  const studentBreakdown = {};

  allLessons.forEach(lesson => {
    if (!studentBreakdown[lesson.studentName]) {
      studentBreakdown[lesson.studentName] = {
        lessons: 0,
        minutes: 0
      };
    }
    studentBreakdown[lesson.studentName].lessons++;
    studentBreakdown[lesson.studentName].minutes += lesson.duration;
  });

  console.log('Student                          | Lessons | Minutes | Payment');
  console.log('-'.repeat(80));

  Object.entries(studentBreakdown)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .forEach(([name, data]) => {
      const hours = data.minutes / 60;
      const payment = hours * TUTOR_HOURLY_RATE;
      console.log(
        `${name.padEnd(32)} | ${String(data.lessons).padStart(7)} | ${String(data.minutes).padStart(7)} | £${payment.toFixed(2)}`
      );
    });

  console.log('-'.repeat(80));
  console.log(`${'TOTAL'.padEnd(32)} | ${String(allLessons.length).padStart(7)} | ${String(totalMinutes).padStart(7)} | £${totalPayment.toFixed(2)}`);
  console.log('\n');

  return {
    tutor: tutorName,
    period: { start: startDate, end: endDate },
    lessons: allLessons,
    totalLessons: allLessons.length,
    totalMinutes: totalMinutes,
    totalHours: totalHours,
    hourlyRate: TUTOR_HOURLY_RATE,
    totalPayment: totalPayment,
    studentBreakdown: studentBreakdown
  };
}

// Fennella's payroll for Sept 10-16, 2025
const startDate = new Date('2025-09-10T00:00:00');
const endDate = new Date('2025-09-16T23:59:59');

// Generate report for Fennella
generatePayrollReport('Fennella', startDate, endDate)
  .then(result => {
    if (result) {
      console.log('✅ Payroll report generated successfully!\n');
    }
  })
  .catch(error => {
    console.error('Error generating payroll report:', error);
  });
