// Shared helper for reading the effective permission matrix fetched from
// GET /permissions/me/ (admin gets an all-true matrix from the backend already).
export const hasPermission = (permissions, menu, action) => {
  return !!(permissions && permissions[menu] && permissions[menu][`can_${action}`]);
};
