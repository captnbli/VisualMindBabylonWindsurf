export const Types = {
    Answer: 'answer',
    Question: 'question',
    Note: 'note',
    Plus: 'plus',
    Minus: 'minus',
    Link: 'link',
    Reference: 'reference'
  } as const;
  
  export type Mode = typeof Types[keyof typeof Types];
  