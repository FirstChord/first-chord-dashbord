-- Kenny's Students Setup
-- Craig Mcaulay
INSERT OR REPLACE INTO students (
  name, first_name, last_name, mms_id, email, 
  current_tutor, soundslice_course, soundslice_username, 
  theta_id, parent_email, instrument, status
) VALUES (
  'Craig Mcaulay', 'Craig', 'Mcaulay', 'sdt_L9nZJs', '',
  'Kenny', 'https://www.soundslice.com/courses/17288/', 'craigfc',
  '', '', 'Guitar', 'Active'
);

-- Olivia Wong
INSERT OR REPLACE INTO students (
  name, first_name, last_name, mms_id, email, 
  current_tutor, soundslice_course, soundslice_username, 
  theta_id, parent_email, instrument, status
) VALUES (
  'Olivia Wong', 'Olivia', 'Wong', 'sdt_LTf0Jx', '',
  'Kenny', 'https://www.soundslice.com/courses/17290/', 'oliviafc',
  '', '', 'Guitar', 'Active'
);

-- Katie Brown
INSERT OR REPLACE INTO students (
  name, first_name, last_name, mms_id, email, 
  current_tutor, soundslice_course, soundslice_username, 
  theta_id, parent_email, instrument, status
) VALUES (
  'Katie Brown', 'Katie', 'Brown', 'sdt_cZsDJp', '',
  'Kenny', 'https://www.soundslice.com/courses/17317/', 'katiefc',
  '', '', 'Guitar', 'Active'
);

-- Nina Brown
INSERT OR REPLACE INTO students (
  name, first_name, last_name, mms_id, email, 
  current_tutor, soundslice_course, soundslice_username, 
  theta_id, parent_email, instrument, status
) VALUES (
  'Nina Brown', 'Nina', 'Brown', 'sdt_cZsMJD', '',
  'Kenny', 'https://www.soundslice.com/courses/17318/', 'ninafc',
  '', '', 'Guitar', 'Active'
);

-- Joe Wallace (no Soundslice)
INSERT OR REPLACE INTO students (
  name, first_name, last_name, mms_id, email, 
  current_tutor, soundslice_course, soundslice_username, 
  theta_id, parent_email, instrument, status
) VALUES (
  'Joe Wallace', 'Joe', 'Wallace', 'sdt_LxdXJC', '',
  'Kenny', '', '',
  '', '', 'Guitar', 'Active'
);

-- Iain Morrison (no MMS ID yet, but has Soundslice)
INSERT OR REPLACE INTO students (
  name, first_name, last_name, mms_id, email, 
  current_tutor, soundslice_course, soundslice_username, 
  theta_id, parent_email, instrument, status
) VALUES (
  'Iain Morrison', 'Iain', 'Morrison', NULL, '',
  'Kenny', 'https://www.soundslice.com/courses/17354/', '',
  '', '', 'Guitar', 'Active'
);