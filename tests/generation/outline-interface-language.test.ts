import { beforeEach, describe, expect, test, vi } from 'vitest';

const streamLLMMock = vi.hoisted(() => vi.fn());
const resolveModelFromRequestMock = vi.hoisted(() => vi.fn());
const resolveVisionImagesMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ai/llm', () => ({ streamLLM: streamLLMMock }));
vi.mock('@/lib/server/resolve-model', () => ({
  resolveModelFromRequest: resolveModelFromRequestMock,
}));
vi.mock('@/lib/persistence/resolve-vision-images', () => ({
  resolveVisionImagesForPrompt: resolveVisionImagesMock,
}));

/**
 * The course language used to be inferred from the requirement text alone, so
 * a two-word English topic typed into a Russian interface produced an English
 * course. The interface language now reaches the planner through the same
 * `x-user-locale` header the PBL routes already use.
 */
describe('scene-outlines-stream carries the interface language', () => {
  beforeEach(() => {
    streamLLMMock.mockReset();
    resolveModelFromRequestMock.mockReset();
    resolveVisionImagesMock.mockReset();
    resolveVisionImagesMock.mockResolvedValue([]);
    resolveModelFromRequestMock.mockResolvedValue({
      model: { provider: 'test.chat', modelId: 'test-model' },
      modelInfo: { outputWindow: 4096, capabilities: { vision: false } },
      modelString: 'test:test-model',
      thinkingConfig: undefined,
    });
    streamLLMMock.mockReturnValue({
      textStream: (async function* () {
        yield JSON.stringify({
          languageDirective: 'Вести курс на русском языке.',
          courseTitle: 'Фотосинтез',
          outlines: [
            {
              id: 'scene_1',
              type: 'slide',
              title: 'Основы',
              description: 'Введение.',
              keyPoints: ['Свет', 'Хлорофилл'],
              order: 1,
            },
          ],
        });
      })(),
    });
  });

  async function runRoute(locale: string | null, interactiveMode = false) {
    vi.resetModules();
    const { POST } = await import('@/app/api/generate/scene-outlines-stream/route');
    const request = {
      json: async () => ({
        requirements: { requirement: 'photosynthesis', interactiveMode },
        researchContext: '',
      }),
      headers: { get: (name: string) => (name === 'x-user-locale' ? locale : null) },
    } as unknown as Parameters<typeof POST>[0];

    const response = await POST(request);
    // Drain the stream so the route finishes its work before we inspect the call.
    await response.text?.();
    return streamLLMMock.mock.calls.at(-1)?.[0] as { prompt?: string; system?: string } | undefined;
  }

  test('states the language in the prompt when the header is present', async () => {
    const call = await runRoute('ru-RU');
    const prompt = `${call?.system ?? ''}\n${call?.prompt ?? ''}`;

    expect(prompt).toContain('**Russian**');
    expect(prompt).toContain('`ru-RU`');
    expect(prompt).toContain('Interface language is the default teaching language');
  });

  test('leaves the prompt as it was when no header is sent', async () => {
    // A caller that does not know the interface language — the eval harness,
    // an old client — must keep the behaviour it was written against.
    const call = await runRoute(null);
    const prompt = `${call?.system ?? ''}\n${call?.prompt ?? ''}`;

    expect(prompt).toContain('Requirement language = teaching language');
    expect(prompt).not.toContain('Interface language is the default teaching language');
  });

  test('reaches the interactive-mode template too', async () => {
    // Interactive mode swaps in an app-only prompt; the language context has to
    // follow, or the setting would apply to standard courses only.
    const call = await runRoute('ru-RU', true);
    const prompt = `${call?.system ?? ''}\n${call?.prompt ?? ''}`;

    expect(prompt).toContain('**Russian**');
    expect(prompt).not.toContain('{{languageContext}}');
  });
});
