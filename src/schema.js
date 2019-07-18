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
  },
};

export default new Schema(schema);
