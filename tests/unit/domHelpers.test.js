import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, createOption, formatFolderPath } from '../../src/popup/dom.js';

function createMockElement(tagName) {
  return {
    tagName,
    className: '',
    id: '',
    textContent: '',
    htmlFor: '',
    type: '',
    value: '',
    title: '',
    attributes: {},
    props: {},
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
}

describe('popup dom helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: vi.fn((tagName) => createMockElement(tagName))
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should format folder paths without the root bookmark folder name', () => {
    expect(formatFolderPath('Bookmarks Bar > Work > AI')).toBe('Work > AI');
    expect(formatFolderPath('Bookmarks bar > Reading')).toBe('Reading');
  });

  it('should keep non-root paths unchanged', () => {
    expect(formatFolderPath('Work > AI')).toBe('Work > AI');
    expect(formatFolderPath('')).toBe('');
  });

  it('should create a configured element', () => {
    const child = createMockElement('span');
    const element = createElement('button', {
      className: 'btn btn-primary',
      id: 'save-btn',
      textContent: 'Save',
      title: 'Save changes',
      attrs: { 'data-action': 'save' },
      props: { disabled: true },
      children: [child]
    });

    expect(document.createElement).toHaveBeenCalledWith('button');
    expect(element.className).toBe('btn btn-primary');
    expect(element.id).toBe('save-btn');
    expect(element.textContent).toBe('Save');
    expect(element.title).toBe('Save changes');
    expect(element.attributes['data-action']).toBe('save');
    expect(element.disabled).toBe(true);
    expect(element.children).toContain(child);
  });

  it('should create an option element with selection state', () => {
    const option = createOption('42', 'Answer', true);

    expect(document.createElement).toHaveBeenCalledWith('option');
    expect(option.value).toBe('42');
    expect(option.textContent).toBe('Answer');
    expect(option.selected).toBe(true);
  });
});
