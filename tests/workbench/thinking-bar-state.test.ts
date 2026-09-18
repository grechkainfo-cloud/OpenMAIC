import { describe, expect, it } from 'vitest';
import {
  thinkingBarPreview,
  thinkingBarSummary,
} from '@/components/workbench/chat/thinking-bar-state';

describe('thinkingBarSummary', () => {
  it('says it is thinking while streaming and that it thought once settled', () => {
    expect(thinkingBarSummary({ streaming: true })).toBe('Думает…');
    expect(thinkingBarSummary({ streaming: true, duration: '1.2s' })).toBe('Думает…');
    expect(thinkingBarSummary({ streaming: false, duration: '3.2s' })).toBe('Думал 3.2s');
    expect(thinkingBarSummary({ streaming: false })).toBe('Подумал');
  });
});

describe('thinkingBarPreview', () => {
  it('uses the newest non-empty line', () => {
    expect(thinkingBarPreview('第一步\n第二步\n\n  \n')).toBe('第二步');
  });
});
