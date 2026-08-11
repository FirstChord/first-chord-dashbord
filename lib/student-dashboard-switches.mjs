const STUDENT_DASHBOARD_SWITCHES = Object.freeze({
  sdt_BtxmJ4: Object.freeze({
    href: '/carol-t',
    label: 'Switch to Bass',
  }),
  sdt_rzL8Jx: Object.freeze({
    href: '/carol',
    label: 'Switch to Singing',
  }),
  sdt_NS6bJW: Object.freeze({
    href: '/tabitha-slocombe',
    label: 'Switch to Voice',
  }),
  sdt_fFZdJb: Object.freeze({
    href: '/tabitha',
    label: 'Switch to Guitar',
  }),
  sdt_r5BkJ0: Object.freeze({
    href: '/evan-g',
    label: 'Switch to Bass',
  }),
  sdt_DP20Js: Object.freeze({
    href: '/evan',
    label: 'Switch to Piano',
  }),
});

export function getStudentDashboardSwitch(studentId) {
  return STUDENT_DASHBOARD_SWITCHES[studentId] || null;
}
