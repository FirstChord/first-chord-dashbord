# Add Student Skill

Quick reference for adding a new student to the dashboard.

## Process

1. **Update Registry CSV**
   - Open `students-registry.csv`
   - Add new row with student data:
     - studentName, teacherName, teacherEmail, tutorName (optional)
   - Save file

2. **Generate Configs**
   ```bash
   npm run generate-configs
   ```

3. **Validate**
   ```bash
   npm run validate
   ```

4. **Test Locally**
   - `npm run dev`
   - Navigate to `/dashboard/[teacherName]`
   - Verify student appears

5. **Deploy**
   - Follow deployment protocol (see `docs/workflows/04-deployment-checklist.md`)

## Common Issues

- **Student not showing**: Check CSV formatting (no extra commas)
- **Portal 404**: Verify studentName matches exactly (case-sensitive)
- **Missing tutor**: Tutor field is optional, can be left empty

## Files Modified
- `students-registry.csv`
- Auto-generated configs in `lib/config/`
