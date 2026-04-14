import { describe, it, expect } from 'vitest'
import { parseReasoning, convertThreadMessageToUIMessage } from './messages'
import { ThreadMessage, ContentType, MessageStatus } from '@janhq/core'

describe('parseReasoning', () => {
  it('should handle in-progress <think> tag', () => {
    const text = '<think>I am thinking about the answer...'
    const result = parseReasoning(text)
    expect(result).toEqual({
      reasoningSegment: text,
      textSegment: '',
    })
  })

  it('should handle in-progress <thought> tag', () => {
    const text = '<thought>I am thinking about the answer...'
    const result = parseReasoning(text)
    expect(result).toEqual({
      reasoningSegment: text,
      textSegment: '',
    })
  })

  it('should handle in-progress analysis channel', () => {
    const text = '<|channel|>analysis<|message|>Analyzing the request...'
    const result = parseReasoning(text)
    expect(result).toEqual({
      reasoningSegment: text,
      textSegment: '',
    })
  })

  it('should handle completed <think> tag', () => {
    const text = '<think>Reasoning here</think>Actual answer here'
    const result = parseReasoning(text)
    expect(result).toEqual({
      reasoningSegment: '<think>Reasoning here</think>',
      textSegment: 'Actual answer here',
    })
  })

  it('should handle completed <thought> tag', () => {
    const text = '<thought>Reasoning here</thought>Actual answer here'
    const result = parseReasoning(text)
    expect(result).toEqual({
      reasoningSegment: '<thought>Reasoning here</thought>',
      textSegment: 'Actual answer here',
    })
  })

  it('should handle completed analysis channel', () => {
    const text = '<|channel|>analysis<|message|>Reasoning here<|start|>assistant<|channel|>final<|message|>Actual answer here'
    const result = parseReasoning(text)
    expect(result).toEqual({
      reasoningSegment: '<|channel|>analysis<|message|>Reasoning here<|start|>assistant<|channel|>final<|message|>',
      textSegment: 'Actual answer here',
    })
  })

  it('should return text as textSegment when no reasoning is present', () => {
    const text = 'Just a normal response'
    const result = parseReasoning(text)
    expect(result).toEqual({
      reasoningSegment: undefined,
      textSegment: text,
    })
  })
})

describe('convertThreadMessageToUIMessage', () => {
  const mockThreadId = 'thread-123'

  it('should convert reasoning content type to reasoning part', () => {
    const threadMessage: ThreadMessage = {
      id: 'msg-1',
      object: 'thread.message',
      thread_id: mockThreadId,
      role: 'assistant' as any,
      content: [
        {
          type: 'reasoning' as ContentType.Reasoning,
          text: { value: 'This is reasoning', annotations: [] },
        },
      ],
      status: MessageStatus.Ready,
      created_at: Date.now(),
      completed_at: Date.now(),
    }

    const uiMessage = convertThreadMessageToUIMessage(threadMessage)
    expect(uiMessage.parts).toContainEqual({
      type: 'reasoning',
      text: 'This is reasoning',
    })
  })

  it('should handle backward compatibility for <think> tags in text content', () => {
    const threadMessage: ThreadMessage = {
      id: 'msg-1',
      object: 'thread.message',
      thread_id: mockThreadId,
      role: 'assistant' as any,
      content: [
        {
          type: ContentType.Text,
          text: { value: '<think>Reasoning here</think>Actual answer', annotations: [] },
        },
      ],
      status: MessageStatus.Ready,
      created_at: Date.now(),
      completed_at: Date.now(),
    }

    const uiMessage = convertThreadMessageToUIMessage(threadMessage)
    expect(uiMessage.parts).toEqual([
      {
        type: 'reasoning',
        text: 'Reasoning here',
      },
      {
        type: 'text',
        text: 'Actual answer',
      },
    ])
  })

  it('should handle in-progress <think> tags in text content', () => {
    const threadMessage: ThreadMessage = {
      id: 'msg-1',
      object: 'thread.message',
      thread_id: mockThreadId,
      role: 'assistant' as any,
      content: [
        {
          type: ContentType.Text,
          text: { value: '<think>I am thinking...', annotations: [] },
        },
      ],
      status: MessageStatus.Ready,
      created_at: Date.now(),
      completed_at: Date.now(),
    }

    const uiMessage = convertThreadMessageToUIMessage(threadMessage)
    expect(uiMessage.parts).toEqual([
      {
        type: 'reasoning',
        text: 'I am thinking...',
      },
    ])
  })

  it('should convert normal text content to text part', () => {
    const threadMessage: ThreadMessage = {
      id: 'msg-1',
      object: 'thread.message',
      thread_id: mockThreadId,
      role: 'assistant' as any,
      content: [
        {
          type: ContentType.Text,
          text: { value: 'Hello world', annotations: [] },
        },
      ],
      status: MessageStatus.Ready,
      created_at: Date.now(),
      completed_at: Date.now(),
    }

    const uiMessage = convertThreadMessageToUIMessage(threadMessage)
    expect(uiMessage.parts).toEqual([
      {
        type: 'text',
        text: 'Hello world',
      },
    ])
  })

  it('should convert image content to file part', () => {
    const threadMessage: ThreadMessage = {
      id: 'msg-1',
      object: 'thread.message',
      thread_id: mockThreadId,
      role: 'user' as any,
      content: [
        {
          type: ContentType.Image,
          image_url: { url: 'https://example.com/image.jpg', detail: 'auto' },
        },
      ],
      status: MessageStatus.Ready,
      created_at: Date.now(),
      completed_at: Date.now(),
    }

    const uiMessage = convertThreadMessageToUIMessage(threadMessage)
    expect(uiMessage.parts).toContainEqual({
      type: 'file',
      mediaType: 'image/jpeg',
      url: 'https://example.com/image.jpg',
    })
  })

  it('should convert tool call content to tool parts', () => {
    const threadMessage: ThreadMessage = {
      id: 'msg-1',
      object: 'thread.message',
      thread_id: mockThreadId,
      role: 'assistant' as any,
      content: [
        {
          type: ContentType.ToolCall,
          tool_call_id: 'call-1',
          tool_name: 'get_weather',
          input: { city: 'London' },
          output: 'Sunny',
        },
      ],
      status: MessageStatus.Ready,
      created_at: Date.now(),
      completed_at: Date.now(),
    }

    const uiMessage = convertThreadMessageToUIMessage(threadMessage)
    expect(uiMessage.parts).toContainEqual({
      type: 'tool-get_weather',
      toolCallId: 'call-1',
      input: { city: 'London' },
      state: 'output-available',
      output: 'Sunny',
    })
  })
})