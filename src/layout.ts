export const sidebarWidthKey = 'stream.sidebar-width.v1'
export const sidebarMinWidth = 184
export const sidebarMaxWidth = 420
export const sidebarDefaultWidth = 232
export const clampSidebarWidth = (width: number): number =>
  Math.round(Math.min(sidebarMaxWidth, Math.max(sidebarMinWidth, width)))
