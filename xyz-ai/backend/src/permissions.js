export const rolePermissions = Object.freeze({
  student: Object.freeze(['view_own_attendance', 'view_class_attendance', 'general_chat', 'escalate_to_human']),
  parent: Object.freeze(['view_child_attendance', 'general_chat', 'escalate_to_human']),
  teacher: Object.freeze(['mark_attendance', 'view_class_attendance', 'general_chat']),
  principal: Object.freeze(['view_school_analytics', 'general_chat']),
});

export function checkPermission(role, intent) {
  return rolePermissions[role]?.includes(intent) ?? false;
}
