# Google Sheets Schema for FirstChord Dashboard

**Purpose**: Replace hardcoded config files with editable Google Sheets

## Sheet Structure

### Sheet 1: Students
**Purpose**: Student roster with portal URLs and service integrations

| Column | Type | Description | Example | Required |
|--------|------|-------------|---------|----------|
| StudentID | Text | MMS student ID | `sdt_H6CvJv` | ✅ Yes |
| FirstName | Text | Student first name | `Mathilde` | ✅ Yes |
| LastName | Text | Student last name | `Thallon` | ✅ Yes |
| FriendlyURL | Text | Portal URL slug | `mathilde` | ✅ Yes |
| TutorName | Text | Primary tutor | `Finn` | ✅ Yes |
| Instrument | Text | Primary instrument | `Piano` | No |
| SoundsliceURL | Text | Course URL | `https://www.soundslice.com/courses/9009/` | No |
| ThetaUsername | Text | Theta Music username | `mathildefc` | No |
| Active | TRUE/FALSE | Is student active? | `TRUE` | ✅ Yes |
| Notes | Text | Admin notes | `Started Sept 2024` | No |

**Example Rows:**
```
StudentID    | FirstName | LastName | FriendlyURL | TutorName | Instrument | SoundsliceURL                           | ThetaUsername | Active | Notes
sdt_H6CvJv   | Mathilde  | Thallon  | mathilde    | Finn      | Piano      | https://www.soundslice.com/courses/9009 | mathildefc    | TRUE   |
sdt_gwyQJr   | Alex      | Chang    | alex        | Finn      | Guitar     | https://www.soundslice.com/courses/4370 | alexfc        | TRUE   |
sdt_L9nZJs   | Craig     | Morrison | craig       | Kenny     | Piano      | https://www.soundslice.com/courses/8652 | craigfc       | TRUE   |
```

---

### Sheet 2: Tutors
**Purpose**: Tutor roster with teacher IDs and rates

| Column | Type | Description | Example | Required |
|--------|------|-------------|---------|----------|
| TutorName | Text | Tutor full name | `Finn Le Marinel` | ✅ Yes |
| ShortName | Text | Display name | `Finn` | ✅ Yes |
| TeacherID | Text | MMS teacher ID | `tch_QhxJJ` | ✅ Yes |
| HourlyRate | Number | Payment rate (£/hour) | `24` | ✅ Yes |
| DefaultInstrument | Text | Primary instrument | `Piano` | No |
| Active | TRUE/FALSE | Is tutor active? | `TRUE` | ✅ Yes |
| Email | Text | Contact email | `finn@firstchord.co.uk` | No |

**Example Rows:**
```
TutorName         | ShortName | TeacherID   | HourlyRate | DefaultInstrument | Active | Email
Finn Le Marinel   | Finn      | tch_QhxJJ   | 24         | Piano             | TRUE   | finn@firstchord.co.uk
Dean Louden       | Dean      | tch_zV9TJN  | 24         | Piano             | TRUE   | dean@firstchord.co.uk
Fennella McCallum | Fennella  | tch_C2bJ9   | 24         | Piano             | TRUE   | fennella@firstchord.co.uk
Kenny Bates       | Kenny     | tch_zsyfJr  | 24         | Guitar            | TRUE   | kenny@firstchord.co.uk
```

---

### Sheet 3: Instruments (Optional Override)
**Purpose**: Override instruments per student (replaces `instrumentOverrides`)

| Column | Type | Description | Example | Required |
|--------|------|-------------|---------|----------|
| StudentID | Text | MMS student ID | `sdt_H6CvJv` | ✅ Yes |
| Instrument | Text | Override instrument | `Piano / Voice` | ✅ Yes |
| Notes | Text | Why override needed | `Multi-instrument student` | No |

**Example Rows:**
```
StudentID    | Instrument    | Notes
sdt_ABC123   | Piano / Voice | Dual lessons
sdt_DEF456   | Bass          | Switched from guitar
```

---

### Sheet 4: Config
**Purpose**: System-wide configuration

| Column | Type | Description | Example | Required |
|--------|------|-------------|---------|----------|
| Key | Text | Config key | `DEFAULT_HOURLY_RATE` | ✅ Yes |
| Value | Text | Config value | `24` | ✅ Yes |
| Description | Text | What this does | `Default tutor hourly rate` | No |

**Example Rows:**
```
Key                    | Value                                        | Description
DEFAULT_HOURLY_RATE    | 24                                          | Default tutor hourly rate (£/hour)
SCHOOL_NAME            | FirstChord Music School                     | School display name
MMS_SCHOOL_ID          | sch_Fx5JQ                                   | MyMusicStaff school ID
THETA_MUSIC_BASE_URL   | https://trainer.thetamusic.com              | Theta Music platform URL
SOUNDSLICE_BASE_URL    | https://www.soundslice.com                  | Soundslice platform URL
```

---

## How Data Flows

### Current (Hardcoded)
```
Config Files (.js) → Next.js App → User sees data
```

### New (Google Sheets with Fallback)
```
                    ┌─ Google Sheets (if available)
Dashboard reads ──┤
                    └─ Config Files (.js) (if Sheet fails)

                    ↓

              Next.js App → User sees data
```

### Edit Flow

**Option 1 - Google Sheet Edit:**
```
1. Edit Google Sheet cell
2. Save (auto-saves)
3. Dashboard page refresh
4. ✅ Data updated
```

**Option 2 - Admin Panel Edit (Future):**
```
1. Fill form in /admin
2. Click Save
3. Writes to Google Sheet
4. Dashboard page refresh
5. ✅ Data updated
```

**Option 3 - Direct Code Edit (You):**
```
1. Edit config .js file
2. git commit & push
3. Railway deploys
4. ✅ Data updated (overrides Sheet if needed)
```

---

## Implementation Plan

### Phase 1: Setup (Week 1)
- [ ] Create Google Sheet template
- [ ] Set up MCP Google Drive integration
- [ ] Create data sync layer (`lib/google-sheets-sync.js`)
- [ ] Add Sheet reading functions

### Phase 2: Migration (Week 1-2)
- [ ] Migrate student data to Sheet
- [ ] Migrate tutor data to Sheet
- [ ] Test fallback to config files
- [ ] Verify all portals still work

### Phase 3: Admin Panel (Week 2-3)
- [ ] Create `/admin` page
- [ ] Add student form
- [ ] Add tutor form
- [ ] Sheet write functionality
- [ ] Authentication (admin only)

### Phase 4: Advanced Features (Week 3-4)
- [ ] Payroll report generator UI
- [ ] CSV import/export
- [ ] Bulk operations
- [ ] Audit log

---

## Safety Features

### 1. Fallback System
If Google Sheets API fails:
- ✅ Dashboard falls back to config files
- ✅ No downtime
- ✅ Warning shown in admin panel

### 2. Validation
Before writing to Sheet:
- ✅ Check required fields
- ✅ Validate MMS IDs format
- ✅ Check for URL conflicts
- ✅ Prevent duplicates

### 3. Backup
- ✅ Config files always exist as backup
- ✅ Git history tracks all changes
- ✅ Google Sheets version history

---

## Benefits

**For Partner (Non-Technical):**
- ✅ Edit in familiar Google Sheets interface
- ✅ No code, no git, no deployment
- ✅ See all data in one place
- ✅ Can share with admin staff

**For You (Technical):**
- ✅ Keep config files as backup
- ✅ Edit Sheet OR files (your choice)
- ✅ Git history still works
- ✅ Can script bulk updates

**For System:**
- ✅ No downtime (fallback exists)
- ✅ Easier to audit changes
- ✅ Can export/import easily
- ✅ Multi-user collaboration

---

## Google Sheet URL Structure

Once created, your Sheet will have a URL like:
```
https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
```

Store `SHEET_ID` in `.env`:
```bash
GOOGLE_SHEET_ID=your_sheet_id_here
```

Dashboard will read from this Sheet as primary data source.

---

## Next Steps

1. **Create Sheet**: I'll create a template Google Sheet
2. **Set up MCP**: Configure Google Drive MCP server
3. **Build sync layer**: Create `lib/google-sheets-sync.js`
4. **Migrate data**: Copy existing config to Sheet
5. **Test**: Verify everything still works
6. **Deploy**: Push to Railway

**Ready to proceed?** This will make your partner's life much easier while keeping your developer workflow intact!
