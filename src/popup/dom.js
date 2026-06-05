/**
 * Shared popup DOM helpers.
 */

export const ROOT_FOLDER_NAMES = new Set([
  'Barre de favoris',
  'Favoris',
  'Bookmarks bar',
  'Bookmarks Bar',
  'Other bookmarks',
  'Autres favoris',
  'Mobile bookmarks'
]);

export function formatFolderPath(path) {
  if (!path) return '';
  const parts = String(path).split(' > ');
  if (parts.length > 1 && ROOT_FOLDER_NAMES.has(parts[0])) {
    return parts.slice(1).join(' > ');
  }
  return parts.join(' > ');
}

export function createElement(tagName, options = {}) {
  const el = document.createElement(tagName);
  if (options.className) el.className = options.className;
  if (options.id) el.id = options.id;
  if (options.textContent !== undefined) el.textContent = options.textContent;
  if (options.htmlFor) el.htmlFor = options.htmlFor;
  if (options.type) el.type = options.type;
  if (options.value !== undefined) el.value = options.value;
  if (options.title !== undefined) el.title = options.title;
  if (options.role !== undefined) el.setAttribute('role', options.role);
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      el.setAttribute(key, value);
    }
  }
  if (options.props) {
    const { style, ...rest } = options.props;
    Object.assign(el, rest);
    if (style) {
      if (typeof style === 'string') {
        el.style.cssText = style;
      } else {
        Object.assign(el.style, style);
      }
    }
  }
  if (options.children) {
    for (const child of options.children) {
      if (child !== null && child !== undefined) el.appendChild(child);
    }
  }
  return el;
}

export function createOption(value, label, selected = false) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  option.selected = selected;
  return option;
}
