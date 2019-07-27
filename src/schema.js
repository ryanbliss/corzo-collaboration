import { Schema } from 'prosemirror-model';

const schema = {
  nodes: {
    doc: {
      content: 'title block+',
    },
    text: {
      group: 'inline',
    },
    paragraph: {
      content: 'inline*',
      group: 'block',
      draggable: false,
      parseDOM: [
        {
          tag: 'p',
        },
      ],
    },
    list_item: {
      content: 'paragraph block*',
      defining: true,
      draggable: false,
      parseDOM: [
        {
          tag: 'li',
        },
      ],
    },
    bullet_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [
        {
          tag: 'ul',
        },
      ],
    },
    ordered_list: {
      attrs: {
        order: {
          default: 1,
        },
      },
      content: 'list_item+',
      group: 'block',
      parseDOM: [
        {
          tag: 'ol',
          getAttrs: dom => ({
            order: dom.hasAttribute('start') ? +dom.getAttribute('start') : 1,
          }),
        },
      ],
    },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [
        {
          tag: 'br',
        },
      ],
    },
    heading: {
      attrs: {
        level: {
          default: 1,
        },
      },
      content: 'inline*',
      group: 'block',
      defining: true,
      draggable: false,
      parseDOM: [
        {
          tag: 'h1',
          attrs: {
            level: 1,
          },
        },
        {
          tag: 'h2',
          attrs: {
            level: 2,
          },
        },
        {
          tag: 'h3',
          attrs: {
            level: 3,
          },
        },
      ],
    },
    title: {
      content: 'inline*',
      parseDOM: [{
        tag: 'h1',
      }],
    },
    todo_item: {
      attrs: {
        done: {
          default: false,
        },
      },
      draggable: true,
      content: '(paragraph|todo_list)+',
      parseDOM: [{
        priority: 51,
        tag: '[data-type="todo_item"]',
        getAttrs: dom => ({
          done: dom.getAttribute('data-done') === 'true',
        }),
      }],
    },
    todo_list: {
      group: 'block',
      content: 'todo_item+',
      parseDOM: [{
        priority: 51,
        tag: '[data-type="todo_list"]',
      }],
    },
    inline_field: {
      attrs: {
        associationId: {},
        fieldId: {},
        label: {},
        value: {},
        fieldType: {},
        initialFocus: {},
      },
      group: 'block',
      selectable: true,
      showGapCursor: true,
      atom: false,
      parseDOM: [
        {
          tag: 'InlineField',
          getAttrs: dom => ({
            associationId: dom.getAttribute('data-association-id'),
            fieldId: dom.getAttribute('data-field-id'),
            label: dom.getAttribute('data-label'),
            value: dom.getAttribute('data-value'),
            fieldType: dom.getAttribute('data-field-type'),
            initialFocus: dom.getAttribute('data-initial-focus'),
          }),
        },
      ],
    },
    blockquote: {
      content: 'block*',
      group: 'block',
      defining: true,
      draggable: false,
      parseDOM: [
        { tag: 'blockquote' },
      ],
    },
  },
  marks: {
    bold: {
      parseDOM: [
        {
          tag: 'strong',
        },
        {
          tag: 'b',
        },
        {
          style: 'font-weight',
        },
      ],
    },
    code: {
      parseDOM: [
        {
          tag: 'code',
        },
      ],
    },
    underline: {
      parseDOM: [
        {
          tag: 'u',
        },
      ],
    },
    strike: {
      parseDOM: [
        {
          tag: 's',
        },
        {
          style: 'text-decoration=line-through',
        },
      ],
    },
    italic: {
      parseDOM: [
        {
          tag: 'i',
        },
        {
          tag: 'em',
        },
        {
          style: 'font-style=italic',
        },
      ],
    },
    link: {
      attrs: {
        href: {
          default: null,
        },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: dom => ({
            href: dom.getAttribute('href'),
          }),
        },
      ],
    },
  },
};

export default new Schema(schema);
