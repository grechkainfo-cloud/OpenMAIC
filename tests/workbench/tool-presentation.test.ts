import { describe, expect, it } from 'vitest';

import {
  isSkillLoadTool,
  isWorkbenchToolFailed,
  presentTool,
} from '@/components/workbench/chat/tool-presentation';
import { GENERATION_TOOL_NAMES } from '@/lib/server/agent-runtime/generation-tools';
import { DSL_COURSE_TOOL_NAMES } from '@/lib/server/agent-runtime/dsl-tools';
import { COURSE_AUDIO_DECK_TOOL_NAMES } from '@/lib/server/agent-runtime/course-edit/tools';
import { MATERIAL_MEDIA_TOOL_NAME } from '@/lib/server/agent-runtime/material-media';
import { CURRICULUM_ALLOWLIST } from '@/lib/server/agent-runtime/curriculum-tools';
import { MATERIAL_TOOL_NAMES } from '@/lib/server/agent-runtime/material-tools';
import { ROSTER_TOOL_NAMES } from '@/lib/server/agent-runtime/roster-tools';
import { VOICE_CLONE_TOOL_NAMES } from '@/lib/server/agent-runtime/voice-clone-tools';
import { RENDER_SCENE_PREVIEW_TOOL_NAME } from '@/lib/server/agent-runtime/scene-preview';
import { SKILL_EDIT_TOOL_NAMES } from '@/lib/server/agent-runtime/skill-edit-tools';
import { createWorkbenchTranslator } from '@/lib/i18n/workbench';
import { supportedLocales } from '@/lib/i18n/locales';
import type { ChatNode } from '@/lib/workbench/session-store';

function toolNode(overrides: Partial<ChatNode> = {}): ChatNode {
  return {
    key: 't1',
    kind: 'tool',
    text: '',
    toolCallId: 'call-1',
    toolName: 'read',
    toolArgs: {},
    toolState: 'done',
    ...overrides,
  } as ChatNode;
}

describe('pi read', () => {
  it('shows a SKILL.md read as loading that skill', () => {
    const presentation = presentTool(
      toolNode({
        toolArgs: { path: '/app/skills/agent-runtime/deep-interactive/SKILL.md' },
      }),
    );
    expect(presentation.label).toBe('Загрузить скилл');
    expect(presentation.subject).toBe('deep-interactive');
    expect(presentation.hidePayload).toBe(true);
    expect(
      isSkillLoadTool(
        toolNode({
          toolArgs: { path: '/app/skills/agent-runtime/deep-interactive/SKILL.md' },
        }),
      ),
    ).toBe(true);
  });

  it('never invents a no-match skill decision', () => {
    const presentation = presentTool(toolNode({ toolArgs: { path: '/app/skills/reference.md' } }));
    expect(presentation.label).toBe('Прочитать файл');
    expect(presentation.label).not.toContain('Скилл');
  });
});

describe('generic typed tool presentation', () => {
  it('shows a create_skill receipt as a normally expandable tool call', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'create_skill',
        toolArgs: { instructions: 'private raw prompt', name: 'my-review' },
        toolDetails: {
          skillId: 'usk_1',
          name: 'my-review',
          title: '复盘方法',
          description: '用于结构化复盘',
          content: '# 复盘\n\n完整步骤',
          source: 'user',
        },
      }),
    );
    expect(presentation).toMatchObject({
      label: 'Skill сохранён',
      subject: '复盘方法 /my-review · 用于结构化复盘',
      expandedResultText: '# 复盘\n\n完整步骤',
    });
    expect(presentation.hidePayload).toBeUndefined();
    expect(presentation.chips).toContainEqual({ label: 'Доступно в новой сессии', tone: 'accent' });
  });

  it('keeps running and failed create_skill input out of the result section', () => {
    for (const toolState of ['running', 'failed'] as const) {
      const presentation = presentTool(
        toolNode({
          toolName: 'create_skill',
          toolState,
          toolArgs: { instructions: '# 尚未保存', name: 'my-review' },
          toolResultText: toolState === 'failed' ? '重名不会覆盖' : undefined,
        }),
      );
      expect(presentation.expandedResultText).toBeUndefined();
    }
  });

  it('shows the tool name and salient query without a dedicated rule', () => {
    // A tool no rule table knows about — the fallback still says WHAT it acted
    // on. Every tool the runner actually registers has a Chinese row (see the
    // reconciliation test below), so this shape is only ever reached by a tool
    // that shipped ahead of its label.
    const presentation = presentTool(
      toolNode({ toolName: 'appraise_widget', toolArgs: { url: 'https://example.com/paper' } }),
    );
    expect(presentation.label).toBe('appraise_widget');
    expect(presentation.subject).toBe('https://example.com/paper');
  });
});

describe('material tool presentation', () => {
  it.each([
    ['list_materials', 'Проверить материалы'],
    ['read_material', 'Прочитать материал'],
    ['use_material_media', 'Использовать медиа из материала'],
    ['search_material', 'Искать в материалах'],
  ])('shows %s as a quiet human-labelled card', (toolName, label) => {
    const presentation = presentTool(
      toolNode({
        toolName,
        toolArgs: { materialId: 'mat_private_wire_id' },
        toolResultText: '{"materialId":"mat_private_wire_id"}',
      }),
    );
    expect(presentation).toMatchObject({ label, hidePayload: true });
    expect(JSON.stringify(presentation)).not.toContain('mat_private_wire_id');
  });

  it('treats a settled material result containing a failed extraction as an error', () => {
    const node = toolNode({
      toolName: 'list_materials',
      toolState: 'done',
      toolDetails: {
        materials: [{ materialId: 'mat_private_wire_id', status: 'failed' }],
      },
    });
    expect(isWorkbenchToolFailed(node)).toBe(true);
    expect(presentTool(node)).toMatchObject({
      label: 'Проверить материалы',
      errorText: 'Не удалось разобрать материал',
      hidePayload: true,
    });
  });
});

/**
 * One language on the timeline. A raw wire name is this rule table's seam
 * showing through the product, so the
 * label of every tool is pinned by name (in the default locale — every locale's
 * copy is checked in `workbench-i18n.test.ts`), and the runner's whole allowlist
 * is reconciled against the switch at the bottom of this file.
 */
describe('every tool has a verb of its own', () => {
  it.each([
    // The series layer.
    ['create_stage', 'Создать класс'],
    ['read_stage_outline', 'Прочитать план класса'],
    // Pages, narration and audio.
    ['generate_scene', 'Создать страницу'],
    ['duplicate_scene', 'Скопировать страницу'],
    ['generate_actions', 'Создать озвучку'],
    ['generate_tts', 'Синтезировать речь'],
    ['render_scene_preview', 'Предпросмотр страницы'],
    ['edit_deck', 'Изменить порядок страниц'],
    // Stage-document tools.
    ['read_stage', 'Прочитать класс'],
    ['patch_stage', 'Изменить класс'],
    ['grep_stage', 'Искать в классе'],
    // Reading its own work.
    ['list_scenes', 'Проверить текущий класс'],
    // Material, questions, the web.
    ['list_materials', 'Проверить материалы'],
    ['read_material', 'Прочитать материал'],
    ['use_material_media', 'Использовать медиа из материала'],
    ['search_material', 'Искать в материалах'],
    ['ask_user', 'Уточнить у вас'],
    ['web_search', 'Поиск в интернете'],
    ['fetch_url', 'Загрузить веб-страницу'],
    // Personal history.
    ['search_classrooms', 'Искать классы'],
    ['read_classroom', 'Прочитать класс'],
    ['search_chats', 'Искать переписки'],
    ['read_chat', 'Прочитать переписку'],
  ])('labels %s as %s', (toolName, label) => {
    expect(presentTool(toolNode({ toolName })).label).toBe(label);
  });

  it('summarizes history pagination without exposing its raw payload', () => {
    expect(
      presentTool(
        toolNode({
          toolName: 'search_chats',
          toolArgs: { query: '语音', offset: 10, limit: 5 },
          toolDetails: { total: 5, nextOffset: 15, hasMore: true },
        }),
      ),
    ).toMatchObject({
      label: 'Искать переписки',
      subject: '语音',
      hidePayload: true,
      chips: [
        { label: 'Записей: 5', tone: 'accent' },
        { label: '11–15' },
        { label: 'Есть ещё результаты' },
      ],
    });
  });

  it('keeps the page verb when the order is known', () => {
    // The order rides the label for the per-page tools, the same way
    // `generate_scene` has always said "generate page 3".
    expect(
      presentTool(toolNode({ toolName: 'generate_actions', toolDetails: { order: 3 } })).label,
    ).toBe('Создать озвучку страницы 3');
    expect(presentTool(toolNode({ toolName: 'generate_tts', toolArgs: { order: 2 } })).label).toBe(
      'Синтезировать речь страницы 2',
    );
  });
});

describe('series layer subjects', () => {
  it('keeps the name create_stage already carries', () => {
    expect(
      presentTool(
        toolNode({
          toolName: 'create_stage',
          toolArgs: { title: '第 1 天: 先跑起来' },
          toolDetails: { stageId: 'stage-x', title: '第 1 天: 先跑起来' },
        }),
      ),
    ).toMatchObject({ label: 'Создать класс', subject: '第 1 天: 先跑起来' });
  });

  it('reads a stage outline as its title and page list', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'read_stage_outline',
        toolArgs: { stageId: 'stage-x' },
        toolDetails: {
          stageId: 'stage-x',
          title: '第 1 天: 先跑起来',
          pageCount: 2,
          pages: [
            { order: 1, title: '装环境', type: 'slide' },
            { order: 2, title: '第一个脚本', type: 'slide' },
          ],
        },
      }),
    );
    expect(presentation.subject).toBe('第 1 天: 先跑起来');
    expect(presentation.detail).toBe('1. 装环境 · 2. 第一个脚本');
    expect(presentation.chips).toEqual([{ label: 'Страниц: 2', tone: 'accent' }]);
  });
});

describe('generate_scene card', () => {
  it('names the page it is writing, and marks a revision as one', () => {
    expect(
      presentTool(toolNode({ toolName: 'generate_scene', toolArgs: { order: 4 } })).label,
    ).toBe('Создать страницу 4');
    const revision = presentTool(
      toolNode({ toolName: 'generate_scene', toolArgs: { order: 4, instruction: '再加一个例子' } }),
    );
    expect(revision.label).toBe('Создать страницу 4');
    expect(revision.chips).toEqual([{ label: 'Исправлено по указанию', tone: 'accent' }]);
    expect(revision.detail).toBe('再加一个例子');
  });
});

describe('ask_user card', () => {
  it('shows the question and its option count, and hides the wire envelope', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'ask_user',
        toolArgs: {
          question: '这门课的听众是谁？',
          options: [
            { id: 'a', label: '零基础' },
            { id: 'b', label: '会另一门语言' },
          ],
        },
        toolDetails: {
          question: '这门课的听众是谁？',
          options: [
            { id: 'a', label: '零基础' },
            { id: 'b', label: '会另一门语言' },
          ],
        },
      }),
    );
    expect(presentation).toMatchObject({
      label: 'Уточнить у вас',
      subject: '这门课的听众是谁？',
      // The question card and the answer form already render the question; the
      // disclosure would be the same sentence a third time.
      hidePayload: true,
    });
    expect(presentation.chips).toEqual([{ label: 'Вариантов: 2' }]);
  });
});

describe('audio details', () => {
  it('flags narration lines that never got audio', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'generate_actions',
        toolDetails: {
          sceneId: 'scene-1',
          order: 2,
          actions: [{}, {}, {}],
          audio: { synthesized: 2, missing: ['a3'] },
        },
      }),
    );
    expect(presentation.chips).toEqual([
      { label: 'Действий: 3', tone: 'accent' },
      { label: 'Озвучено фраз: 2' },
      { label: 'Фраз без озвучки: 1', tone: 'warn' },
    ]);
  });

  it('names the missing TTS provider instead of echoing the raw result', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'generate_tts',
        toolState: 'failed',
        toolDetails: { sceneId: 'scene-1', order: 2, provider: null },
        toolResultText: 'No server TTS provider is configured, so nothing was synthesized.',
      }),
    );
    expect(presentation.errorText).toBe(
      'Синтез речи не настроен, поэтому на этой странице по-прежнему нет звука',
    );
  });
});

describe('DSL stage tools', () => {
  it('names the document subtree read_stage aimed at', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'read_stage',
        toolArgs: { stageId: 'stage-x', path: '/outline', detail: 'source' },
        toolDetails: { path: '/outline', detail: 'source', totalChars: 1024 },
      }),
    );
    expect(presentation).toMatchObject({ label: 'Прочитать класс', subject: '/outline' });
    // The whole stage (path "") reads as the verb alone, never the wire id.
    expect(
      presentTool(toolNode({ toolName: 'read_stage', toolArgs: { stageId: 'stage-x', path: '' } }))
        .subject,
    ).toBeUndefined();
  });

  it('summarises a patch by its intent and the page it landed on', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'patch_stage',
        toolArgs: { stageId: 'stage-x', intent: '改标题为「光的折射」' },
        toolDetails: {
          intent: '改标题为「光的折射」',
          updated: { sceneId: 'scene-1', order: 3, type: 'slide', ops: 2 },
        },
      }),
    );
    expect(presentation).toMatchObject({
      label: 'Изменить класс',
      subject: '改标题为「光的折射」',
      chips: [{ label: 'Страница 3' }],
    });
  });

  it('reports grep_stage hits and truncation as chips', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'grep_stage',
        toolArgs: { stageId: 'stage-x', query: '折射', scope: 'text' },
        toolDetails: { query: '折射', scope: 'text', hits: [{}, {}], truncated: true },
      }),
    );
    expect(presentation).toMatchObject({ label: 'Искать в классе', subject: '折射' });
    expect(presentation.chips).toEqual([
      { label: 'Совпадений: 2', tone: 'accent' },
      { label: 'Обрезано', tone: 'warn' },
    ]);
  });
});

/**
 * Untrusted content discipline: tool results that carry fetched/material
 * content are DATA, never assistant speech. The row shows the labelled form —
 * the argument the reader chose, plus a chip that names the source as outside
 * the session — and the fetched body stays in the result section behind the
 * disclosure, never promoted to the one-line summary.
 */
describe('untrusted content stays labelled data', () => {
  it('labels a fetch_url refused by the session trust gate', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'fetch_url',
        toolArgs: { url: 'https://untrusted.example/page' },
        toolDetails: { trusted: { status: 'url_not_in_session' } },
        toolResultText: '<html>private remote body</html>',
      }),
    );
    expect(presentation).toMatchObject({
      label: 'Загрузить веб-страницу',
      // The subject is the URL from the ARGUMENTS — product chrome — never the
      // fetched page's own title or body.
      subject: 'https://untrusted.example/page',
    });
    expect(presentation.chips).toContainEqual({ label: 'Источник вне этой сессии', tone: 'warn' });
    // The fetched body is data, not speech: the presentation is built from the
    // argument and the trusted-status chip, and the raw body never leaks into
    // the summary or the disclosure text of the collapsed row.
    expect(presentation.subject).not.toContain('private remote body');
    expect(JSON.stringify(presentation)).not.toContain('private remote body');
  });

  it('does not claim untrustedness when the session trusted the fetch', () => {
    const presentation = presentTool(
      toolNode({
        toolName: 'fetch_url',
        toolArgs: { url: 'https://trusted.example/page' },
        toolDetails: { trusted: { status: 'done' } },
      }),
    );
    expect(presentation.chips).toEqual([]);
    expect(presentation.subject).toBe('https://trusted.example/page');
  });
});

/**
 * The reconciliation: every tool the agent runtime registers must have a row in
 * the presentation table. The allowlists below are the same sets the runner
 * builds its capability gate from, so a tool cannot enter the product without
 * passing through here.
 */
describe('allowlist ↔ presentation reconciliation', () => {
  const runnerTools = [
    ...DSL_COURSE_TOOL_NAMES,
    ...GENERATION_TOOL_NAMES,
    ...COURSE_AUDIO_DECK_TOOL_NAMES,
    MATERIAL_MEDIA_TOOL_NAME,
    RENDER_SCENE_PREVIEW_TOOL_NAME,
    ...CURRICULUM_ALLOWLIST,
    ...MATERIAL_TOOL_NAMES,
    ...ROSTER_TOOL_NAMES,
    ...VOICE_CLONE_TOOL_NAMES,
    ...SKILL_EDIT_TOOL_NAMES,
    'create_skill',
    // ask_user is the runner's minimal agent latch; web_search is
    // capability-gated; `read` is Pi's native skill read, registered whenever
    // any skill is installed.
    'ask_user',
    'web_search',
    'read',
  ];

  it.each(runnerTools)('%s has a label of its own, not its wire name', (toolName) => {
    const presentation = presentTool(toolNode({ toolName }));
    expect(presentation.label, `${toolName} falls through to the default branch`).not.toBe(
      toolName,
    );
    // Not merely "different": a real sentence in every supported locale. A label
    // that resolves to its own copy key would satisfy "not the wire name" while
    // rendering `workbench.tool.label.x` on the card.
    for (const locale of supportedLocales) {
      const label = presentTool(
        toolNode({ toolName }),
        [],
        createWorkbenchTranslator(locale.code),
      ).label;
      expect(label, `${toolName} has no ${locale.code} label`).not.toMatch(/^workbench\./);
      expect(label.trim(), `${toolName} has an empty ${locale.code} label`).not.toBe('');
    }
  });

  it('covers the whole runner allowlist, so this list cannot silently shrink', () => {
    // A sanity floor on the fixture itself: if a refactor empties one of the
    // imported sets, the it.each above would pass vacuously.
    expect(runnerTools.length).toBeGreaterThanOrEqual(22);
    for (const tool of ['generate_scene', 'create_stage', 'fetch_url', 'read_stage']) {
      expect(runnerTools, tool).toContain(tool);
    }
    // The retired planning tools are not in the allowlist (their presentation
    // rows above still exist so historical transcripts replay cleanly).
    expect(runnerTools).not.toContain('generate_outline');
    expect(runnerTools).not.toContain('generate_roster');
    for (const legacy of [
      'read_scene',
      'edit_slide',
      'edit_quiz',
      'edit_widget',
      'edit_actions',
      'edit_pbl',
    ]) {
      expect(runnerTools).not.toContain(legacy);
      expect(presentTool(toolNode({ toolName: legacy })).label).toBe(legacy);
    }
  });
});
